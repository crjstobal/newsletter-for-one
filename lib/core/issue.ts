import { hostOf, onDomain, type DateResolver, type LLM, type Search, type SearchRequest, type Tracker } from "./ports";
import type { CandidateStatus, Issue, Newsletter, QualityCheck, Story, Trace, TraceCandidate, TraceStep } from "./types";
import { planQueries } from "./planner";
import { triage, type Candidate, type Scored } from "./triage";
import { writeIssue } from "./editor";
import { checkMemory, type Verdict } from "./dedup";

export const SHORTLIST = 24;
export const MIN_SCORE = 6;
/** Variety: no site may fill more than this share of the shortlist or of the issue. */
export const MAX_SHORTLIST_PER_SITE = 6;
export const MAX_STORIES_PER_SITE = 2;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function windowStart(nl: Newsletter, now: Date): string {
  // A second issue on the same day would search an empty window; fall back to the cadence.
  if (nl.lastIssueDate && nl.lastIssueDate < isoDate(now)) return nl.lastIssueDate;
  const days = nl.profile.cadence === "daily" ? 2 : 8;
  return isoDate(new Date(now.getTime() - days * 86_400_000));
}

function normalizeUrl(u: string) {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const p of [...url.searchParams.keys()]) if (p.startsWith("utm_")) url.searchParams.delete(p);
    return url.toString().replace(/\/$/, "");
  } catch {
    return u;
  }
}

export type Progress = (step: string, detail?: string) => void;

const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

/**
 * One issue, end to end:
 * plan searches -> search the web -> triage every hit -> filter (window, block list, already sent)
 * -> editor writes the issue from the shortlist only.
 * Every step is recorded in `issue.trace` so the reader (and we) can see how it was made.
 */
export async function produceIssue(
  deps: { llm: LLM; search: Search; dates: DateResolver; tracker: Tracker },
  nl: Newsletter,
  progress: Progress = () => {},
  now = new Date(),
): Promise<Issue> {
  const t0 = Date.now();
  const { llm, search, dates, tracker } = deps;
  const profile = { ...nl.profile, blockedDomains: nl.profile.blockedDomains ?? [] };
  const today = isoDate(now);
  const since = windowStart(nl, now);
  const steps: TraceStep[] = [];
  const llmCost = (from: number) => sum(tracker.llm.slice(from), (c) => c.costUsd);

  // 1. Plan
  let t = Date.now();
  let mark = tracker.llm.length;
  progress("plan", `window ${since} → ${today}`);
  const planned = await planQueries(llm, profile, nl.memory, today, since);
  steps.push({
    key: "plan", label: "Plan searches", tool: llm.models.planner, ms: Date.now() - t, costUsd: llmCost(mark),
    summary: `${planned.length} searches planned`,
  });

  // 2. Search: the planned queries plus one dedicated search over the reader's preferred sources.
  const requests: SearchRequest[] = planned.map((q) => ({
    query: q.kind === "reddit" && profile.subreddits[0] && !/r\//.test(q.query) ? `${q.query} r/${profile.subreddits[0]}` : q.query,
    kind: q.kind,
    why: q.why,
    since,
    excludeDomains: profile.blockedDomains,
    language: q.lang,
  }));
  if (profile.domains.length) {
    requests.push({
      query: profile.coreQuery || profile.name,
      kind: "sources",
      why: "Your preferred sources, searched directly every issue",
      since,
      includeDomains: profile.domains,
      excludeDomains: profile.blockedDomains,
    });
  }

  t = Date.now();
  const searchMark = tracker.searches.length;
  progress("search", `${requests.length} searches on Tavily`);
  const hitLists = await Promise.all(
    requests.map((r) =>
      search.search(r).catch((err) => {
        progress("search-error", `${r.query}: ${(err as Error).message}`);
        return [];
      }),
    ),
  );
  const searches = tracker.searches.slice(searchMark);

  const byUrl = new Map<string, Candidate & { foundBy: number[] }>();
  let nextId = 0;
  hitLists.forEach((hits, qi) => {
    for (const h of hits) {
      const key = normalizeUrl(h.url);
      const existing = byUrl.get(key);
      if (existing) existing.foundBy.push(qi);
      else byUrl.set(key, { ...h, url: key, id: nextId++, foundBy: [qi] });
    }
  });
  const all = [...byUrl.values()];
  const blocked = all.filter((c) => profile.blockedDomains.some((d) => onDomain(c.url, d)));
  const candidates = all.filter((c) => !blocked.includes(c));
  steps.push({
    key: "search", label: "Search the web", tool: "Tavily", ms: Date.now() - t, costUsd: sum(searches, (s) => s.costUsd),
    summary: `${sum(searches, (s) => s.hits)} results, ${all.length} unique`,
  });

  // 3. Triage
  t = Date.now();
  mark = tracker.llm.length;
  progress("triage", `scoring ${candidates.length} results`);
  const scored = await triage(llm, profile, nl.memory, candidates, today, since);
  steps.push({
    key: "triage", label: "Score every result", tool: llm.models.triage, ms: Date.now() - t, costUsd: llmCost(mark),
    summary: `${scored.length} scored, ${scored.filter((s) => s.score >= MIN_SCORE).length} at ${MIN_SCORE}+`,
  });

  // 4. Verify dates: every promising result without a search-engine date gets its page checked.
  t = Date.now();
  const dateNotes = new Map<number, string>();
  const toVerify = scored.filter((s) => s.score >= MIN_SCORE && s.dateFrom !== "search");
  progress("dates", `verifying ${toVerify.length} dates`);
  await mapLimit(toVerify, 8, async (s) => {
    const r = await dates.resolve(s.url);
    dateNotes.set(s.id, r.note);
    if (r.date) {
      s.publishedDate = r.date;
      s.dateFrom = "page";
    } else if (r.withinWindow && s.dateFrom === "none") {
      s.dateFrom = "window";
    }
  });
  for (const s of scored) if (s.dateFrom === "search") dateNotes.set(s.id, "search engine date");
  const verified = toVerify.filter((s) => s.dateFrom === "page").length;
  steps.push({
    key: "dates", label: "Verify dates", tool: "Page metadata / platform APIs (no model)", ms: Date.now() - t, costUsd: 0,
    summary: `${toVerify.length} checked, ${verified} dated, ${toVerify.length - verified} unknown`,
  });

  // 5. Filter (deterministic, no model)
  t = Date.now();
  const coveredKeys = new Set(nl.memory.covered.map((c) => c.key));
  const searchLanguages = profile.searchLanguages?.length ? profile.searchLanguages : ["en"];
  const status = new Map<number, CandidateStatus>();
  for (const s of scored) {
    if (s.lang && !searchLanguages.includes(s.lang)) status.set(s.id, "wrong-language");
    else if (s.publishedDate && s.publishedDate < since) status.set(s.id, "too-old");
    else if (s.score < MIN_SCORE) status.set(s.id, "low-score");
    else if (s.dateFrom === "none" && !profile.allowUndated) status.set(s.id, "no-date");
    else if (coveredKeys.has(s.eventKey)) status.set(s.id, "already-sent");
  }
  const perSite = new Map<string, number>();
  const shortlist: Scored[] = [];
  for (const s of scored.filter((x) => !status.has(x.id)).sort((a, b) => b.score - a.score)) {
    const host = hostOf(s.url);
    const platform = host === "youtube.com" || host === "reddit.com";
    const site = platform ? `${host}#${s.id}` : host; // channels are only known later; don't cap platforms here
    if ((perSite.get(site) ?? 0) >= MAX_SHORTLIST_PER_SITE || shortlist.length >= SHORTLIST) continue;
    perSite.set(site, (perSite.get(site) ?? 0) + 1);
    shortlist.push(s);
  }
  for (const s of shortlist) status.set(s.id, "shortlisted");
  const count = (st: CandidateStatus) => [...status.values()].filter((x) => x === st).length;
  steps.push({
    key: "filter", label: "Filter", tool: "Rules (no model)", ms: Date.now() - t, costUsd: 0,
    summary: `${shortlist.length} kept · ${count("wrong-language")} wrong language · ${count("too-old")} too old · ${count("no-date")} no date · ${count("low-score")} low score · ${count("already-sent")} already sent · ${blocked.length} blocked`,
  });

  // 6. Memory check: the same news, however worded, is never sent twice nor twice in one issue.
  t = Date.now();
  mark = tracker.llm.length;
  progress("memory", `comparing ${shortlist.length} candidates with ${nl.memory.covered.length} sent stories`);
  // A failure here must not sink the issue: exact event-key matching (step 5) still applies.
  let memoryFailed: string | undefined;
  const verdicts = await checkMemory(llm, shortlist, nl.memory.covered).catch((err) => {
    memoryFailed = (err as Error).message.slice(0, 120);
    return new Map<number, Verdict>();
  });
  const sameAsNote = new Map<number, string>();
  const byIdShort = new Map(shortlist.map((s) => [s.id, s]));
  const coveredByKey = new Map(nl.memory.covered.map((c) => [c.key, c]));
  const rootOf = (id: number, seen = new Set<number>()): number => {
    const next = verdicts.get(id)?.sameAs;
    return next === undefined || seen.has(next) ? id : rootOf(next, seen.add(id));
  };
  for (const s of shortlist) {
    const v = verdicts.get(s.id);
    const root = verdicts.get(rootOf(s.id));
    const sent = v?.sentKey ?? root?.sentKey;
    if (sent) {
      status.set(s.id, "already-sent");
      const c = coveredByKey.get(sent);
      sameAsNote.set(s.id, `${c?.date ?? ""}: ${c?.headline ?? sent}${v?.why ? ` (${v.why})` : ""}`);
    } else if (v?.sameAs !== undefined) {
      status.set(s.id, "duplicate");
      sameAsNote.set(s.id, `${byIdShort.get(rootOf(s.id))?.title ?? "another result"}${v.why ? ` (${v.why})` : ""}`);
    }
  }
  const fresh = shortlist.filter((s) => status.get(s.id) === "shortlisted");
  steps.push({
    key: "memory", label: "Check memory", tool: llm.models.dedup, ms: Date.now() - t, costUsd: llmCost(mark),
    summary: memoryFailed
      ? `check failed, only exact matches filtered (${memoryFailed})`
      : `${count("already-sent")} already sent, ${count("duplicate")} duplicates, ${fresh.length} new`,
  });

  // 7. Edit. Variety is per publisher: each YouTube channel or subreddit counts on its own.
  t = Date.now();
  mark = tracker.llm.length;
  progress("edit", `writing from ${fresh.length} sources`);
  const publishers = new Map<number, string>();
  await Promise.all(fresh.map(async (s) => {
    const platform = onDomain(s.url, "youtube.com") || onDomain(s.url, "youtu.be") || onDomain(s.url, "reddit.com");
    publishers.set(s.id, (platform && (await dates.resolve(s.url)).publisher) || hostOf(s.url));
  }));
  const written = await writeIssue(llm, profile, nl.memory, fresh, today, MAX_STORIES_PER_SITE, (id) => publishers.get(id) ?? "");
  written.sourceIds.forEach((id) => status.set(id, "used"));
  // Preview images published by each source (cached: most pages were opened to check dates).
  await Promise.all(written.stories.map(async (s) => {
    s.image = (await dates.resolve(s.url)).image;
  }));
  steps.push({
    key: "edit", label: "Write the issue", tool: llm.models.editor, ms: Date.now() - t, costUsd: llmCost(mark),
    summary: `${written.stories.length} stories from ${new Set(written.stories.map((s) => s.publisher ?? s.source)).size} publishers${written.dropped ? `, ${written.dropped} dropped for variety` : ""}${written.quiet ? " (quiet issue)" : ""}`,
  });

  // Trace
  const scoredById = new Map(scored.map((s) => [s.id, s]));
  const traceCandidates: TraceCandidate[] = all.map((c) => {
    const s = scoredById.get(c.id);
    const storyIndex = written.sourceIds.indexOf(c.id);
    return {
      id: c.id,
      url: c.url,
      title: c.title,
      source: hostOf(c.url),
      publishedDate: s?.publishedDate ?? c.publishedDate,
      dateFrom: s?.dateFrom ?? (c.publishedDate ? "search" : "none"),
      dateNote: dateNotes.get(c.id),
      foundBy: c.foundBy,
      score: s?.score,
      eventKey: s?.eventKey,
      status: blocked.includes(c) ? "blocked" : status.get(c.id) ?? "unscored",
      storyIndex: storyIndex >= 0 ? storyIndex : undefined,
      lang: s?.lang,
      sameAs: sameAsNote.get(c.id) ?? (status.get(c.id) === "already-sent" ? coveredByKey.get(s?.eventKey ?? "")?.headline : undefined),
    };
  });

  const nebiusUsd = sum(tracker.llm, (c) => c.costUsd);
  const tavilyUsd = sum(searches, (s) => s.costUsd);
  const trace: Trace = {
    window: { since, until: today },
    steps,
    searches,
    candidates: traceCandidates,
    llmCalls: tracker.llm,
    checks: [
      ...(memoryFailed ? [{ level: "warn" as const, message: "Memory check failed: repeats were only filtered by exact match, check nothing was sent before" }] : []),
      ...qualityChecks(written.stories, written.quiet, traceCandidates, searches.filter((s) => s.error).length, since, profile.storyCount),
    ],
    totals: {
      costUsd: nebiusUsd + tavilyUsd,
      nebiusUsd,
      tavilyUsd,
      tavilyCredits: sum(searches, (s) => s.credits),
      promptTokens: sum(tracker.llm, (c) => c.promptTokens),
      completionTokens: sum(tracker.llm, (c) => c.completionTokens),
      ms: Date.now() - t0,
    },
  };

  return {
    id: `${nl.id}-${today}-${Date.now().toString(36)}`,
    newsletterId: nl.id,
    date: today,
    subject: written.subject,
    intro: written.intro,
    stories: written.stories,
    quiet: written.quiet,
    trace,
  };
}

/** Deterministic checks that flag an issue a human should look at before trusting it. */
function qualityChecks(
  stories: Story[],
  quiet: boolean,
  candidates: TraceCandidate[],
  searchErrors: number,
  since: string,
  wanted: number,
): QualityCheck[] {
  const checks: QualityCheck[] = [];
  if (searchErrors) checks.push({ level: "bad", message: `${searchErrors} searches failed` });
  if (quiet) checks.push({ level: "warn", message: "Quiet issue: nothing was judged worth sending" });

  const old = stories.filter((s) => s.publishedDate && s.publishedDate < since);
  if (old.length) checks.push({ level: "bad", message: `${old.length} stories are dated before the window` });
  const undated = stories.filter((s) => !s.publishedDate && s.dateFrom !== "window");
  const windowOnly = stories.filter((s) => s.dateFrom === "window");
  if (windowOnly.length) checks.push({ level: "ok", message: `${windowOnly.length} Reddit ${windowOnly.length > 1 ? "posts" : "post"} dated by the search window only (Reddit gives no dates without an API key)` });
  const modelDated = stories.filter((s) => s.dateFrom === "model");
  if (undated.length) checks.push({ level: "warn", message: `${undated.length} of ${stories.length} stories have no date at all: check they are recent` });
  if (modelDated.length) checks.push({ level: "warn", message: `${modelDated.length} stories dated by reading the text, not by the search engine` });
  if (!undated.length && !modelDated.length && !old.length && !windowOnly.length && stories.length)
    checks.push({ level: "ok", message: "Every story has a verified date inside the window" });

  if (stories.length < wanted && !quiet)
    checks.push({ level: "warn", message: `${stories.length} of ${wanted} stories: not enough good material this window` });
  if (candidates.length < 20)
    checks.push({ level: "warn", message: `Only ${candidates.length} unique results: the topic may be too narrow for this window` });

  const bySource = new Map<string, number>();
  for (const s of stories) bySource.set(s.publisher ?? s.source, (bySource.get(s.publisher ?? s.source) ?? 0) + 1);
  const [topSource, topCount] = [...bySource.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
  if (stories.length >= 3 && topCount / stories.length > 0.5)
    checks.push({ level: "warn", message: `${topCount} of ${stories.length} stories come from ${topSource}` });
  else if (stories.length >= 3 && bySource.size === 2)
    checks.push({ level: "warn", message: "Only 2 different publishers in this issue" });
  else if (stories.length >= 3) checks.push({ level: "ok", message: `${bySource.size} different publishers` });

  const social = stories.filter((s) => /(^|\.)(facebook|x|twitter|instagram|tiktok)\.com$/.test(s.source));
  if (social.length) checks.push({ level: "warn", message: `${social.length} stories cite social posts: harder to verify` });
  return checks;
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function mapLimit<T>(items: T[], limit: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}
