import { nebiusLLM } from "./adapters/nebius";
import { tavilySearch } from "./adapters/tavily";
import { pageDates } from "./adapters/dates";
import { newTracker, type Tracker } from "./core/ports";
import { normalizeStyle, type Delivery, type Issue, type Newsletter, type Profile, type ReaderMemory, type Style } from "./core/types";
import { addDays, cleanDelivery, dateIn, deliveryOf, gapDays } from "./core/schedule";
import { addFeed, listSubscriptions, pgSubscriptions, readingSignals, removeSubscription } from "./subscriptions";
import { hostOf } from "./core/ports";
import { buildProfile } from "./core/profile";
import { produceIssue, type Progress } from "./core/issue";
import { emptyMemory, learnFromFeedback, rememberIssue, type Reaction } from "./core/memory";
import { store as defaultStore, type Store } from "./store";
import { reserve, settle, type SpendKind } from "./budget";
import { q } from "./db";

/** Application service: wires adapters and storage around the vendor-free core. */

function deps() {
  const tracker = newTracker();
  return { tracker, llm: nebiusLLM(tracker), search: tavilySearch(tracker), dates: pageDates() };
}

const costOf = (tracker: Tracker) =>
  tracker.llm.reduce((a, c) => a + c.costUsd, 0) + tracker.searches.reduce((a, s) => a + s.costUsd, 0);

/**
 * Runs paid work under the daily cap: reserves its estimate first (throws BudgetExceeded if the
 * day's budget can't cover it), then records what it really cost, even if it failed halfway.
 */
async function metered<T>(kind: SpendKind, newsletterId: string | undefined, work: (d: ReturnType<typeof deps>) => Promise<T>, issueIdOf?: (r: T) => string) {
  const reservation = await reserve(kind, { newsletterId });
  const d = deps();
  try {
    const result = await work(d);
    await settle(reservation, costOf(d.tracker), { issueId: issueIdOf?.(result) });
    return result;
  } catch (err) {
    await settle(reservation, costOf(d.tracker));
    throw err;
  }
}

const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

export async function createNewsletter(
  description: string,
  language?: string,
  store: Store = defaultStore,
): Promise<Newsletter> {
  const profile = await metered("brief", undefined, ({ llm }) => buildProfile(llm, description, language));
  const nl: Newsletter = {
    id: `${slug(profile.name)}-${Date.now().toString(36)}`,
    description,
    profile,
    memory: emptyMemory(),
    createdAt: new Date().toISOString(),
    // A newsletter writes itself on its delivery days; Pause is how it stops.
    autoIssues: true,
  };
  await store.saveNewsletter(nl);
  return nl;
}

export async function runIssue(newsletterId: string, progress?: Progress, store: Store = defaultStore): Promise<Issue> {
  const nl = await store.getNewsletter(newsletterId);
  if (!nl) throw new Error(`Newsletter ${newsletterId} not found`);
  // What the reader actually opens steers this issue too (computed from clicks, never stored).
  const reads = await readingSignals(newsletterId).catch(() => []);
  const withReads = { ...nl, memory: { ...nl.memory, reads } };
  // Every step is also written to the database, so the web app can show a Nebius job's progress.
  const tracked: Progress = (step, detail) => {
    progress?.(step, detail);
    void saveProgress(newsletterId, step, detail);
  };
  try {
    const issue = await metered("issue", newsletterId, (d) => produceIssue({ ...d, subscriptions: pgSubscriptions(newsletterId) }, withReads, tracked), (i) => i.id);
    issue.number = (await store.listIssues(newsletterId)).length + 1;
    await store.saveIssue(issue);
    await store.saveNewsletter({ ...nl, memory: rememberIssue(nl.memory, issue), lastIssueDate: issue.date });
    return issue;
  } finally {
    await q("delete from issue_progress where newsletter_id = $1", [newsletterId]).catch(() => {});
  }
}

/** Best effort: progress is a courtesy for the page, never a reason to fail an issue. */
async function saveProgress(newsletterId: string, step: string, detail?: string) {
  await q(
    `insert into issue_progress (newsletter_id, step, detail, at) values ($1, $2, $3, now())
     on conflict (newsletter_id) do update set step = excluded.step, detail = excluded.detail, at = now()`,
    [newsletterId, step, detail ?? null],
  ).catch(() => {});
}

/** The step an issue is on right now, if one is being written. */
export async function currentProgress(newsletterId: string): Promise<{ step: string; detail: string | null; at: string } | null> {
  const r = await q<{ step: string; detail: string | null; at: Date }>(
    "select step, detail, at from issue_progress where newsletter_id = $1 and at > now() - interval '30 minutes'",
    [newsletterId],
  ).catch(() => null);
  const row = r?.rows[0];
  return row ? { step: row.step, detail: row.detail, at: row.at.toISOString() } : null;
}

export type Vote = { storyIndex: number; vote: "up" | "down"; note?: string };

/** Records votes on an issue and folds them into the reader's preference model. */
export async function giveFeedback(issueId: string, votes: Vote[], store: Store = defaultStore): Promise<Newsletter> {
  const issue = await store.getIssue(issueId);
  if (!issue) throw new Error(`Issue ${issueId} not found`);
  const nl = await store.getNewsletter(issue.newsletterId);
  if (!nl) throw new Error(`Newsletter ${issue.newsletterId} not found`);

  const reactions: Reaction[] = [];
  for (const v of votes) {
    const story = issue.stories[v.storyIndex];
    if (!story) continue;
    story.feedback = v.vote;
    reactions.push({ headline: story.headline, summary: story.summary, source: story.source, vote: v.vote, note: v.note });
  }
  await store.saveIssue(issue);

  const memory = await metered("feedback", nl.id, ({ llm }) => learnFromFeedback(llm, nl.profile, nl.memory, reactions));
  const updated = { ...nl, memory };
  await store.saveNewsletter(updated);
  return updated;
}

/** Clears what was learned about the reader, keeping the brief. Handy while testing. */
export async function resetMemory(newsletterId: string, store: Store = defaultStore): Promise<Newsletter> {
  const nl = await store.getNewsletter(newsletterId);
  if (!nl) throw new Error(`Newsletter ${newsletterId} not found`);
  const updated = { ...nl, memory: emptyMemory(), lastIssueDate: undefined };
  await store.saveNewsletter(updated);
  return updated;
}

/** Reader-editable settings. Only known fields are accepted. */
export async function updateProfile(newsletterId: string, patch: Partial<Profile>, store: Store = defaultStore): Promise<Newsletter> {
  const nl = await store.getNewsletter(newsletterId);
  if (!nl) throw new Error(`Newsletter ${newsletterId} not found`);
  const clean = (xs: unknown) => (Array.isArray(xs) ? xs.map((x) => String(x).trim()).filter(Boolean) : undefined);
  const domain = (d: string) => d.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
  const p = { ...nl.profile };
  if (patch.name) p.name = String(patch.name);
  if (patch.topic) p.topic = String(patch.topic);
  if (patch.audience) p.audience = String(patch.audience);
  if (patch.tone) p.tone = String(patch.tone);
  if (patch.language) p.language = String(patch.language);
  if (patch.cadence === "daily" || patch.cadence === "weekly") p.cadence = patch.cadence;
  if (patch.storyCount) p.storyCount = Math.min(10, Math.max(1, Number(patch.storyCount)));
  if (typeof patch.youtube === "boolean") p.youtube = patch.youtube;
  if (typeof patch.allowUndated === "boolean") p.allowUndated = patch.allowUndated;
  if (patch.style) p.style = cleanStyle(patch.style);
  if (clean(patch.searchLanguages)) p.searchLanguages = clean(patch.searchLanguages)!;
  if (clean(patch.mustCover)) p.mustCover = clean(patch.mustCover)!;
  if (clean(patch.avoid)) p.avoid = clean(patch.avoid)!;
  if (clean(patch.subreddits)) p.subreddits = clean(patch.subreddits)!.map((s) => s.replace(/^r\//, ""));
  if (typeof patch.coreQuery === "string" && patch.coreQuery.trim()) p.coreQuery = patch.coreQuery.trim();
  if (clean(patch.watchlist)) p.watchlist = clean(patch.watchlist)!;
  if (clean(patch.domains)) p.domains = [...new Set(clean(patch.domains)!.map(domain))];
  if (clean(patch.blockedDomains)) p.blockedDomains = [...new Set(clean(patch.blockedDomains)!.map(domain))];
  p.domains = p.domains.filter((d) => !(p.blockedDomains ?? []).includes(d));
  const updated = { ...nl, profile: p };
  await store.saveNewsletter(updated);
  return updated;
}

/** Reader edits to what was learned: rewrite or drop preferences, forget sent stories. */
export async function updateMemory(
  newsletterId: string,
  patch: Partial<Pick<ReaderMemory, "likes" | "dislikes" | "notes" | "covered">>,
  store: Store = defaultStore,
): Promise<Newsletter> {
  const nl = await store.getNewsletter(newsletterId);
  if (!nl) throw new Error(`Newsletter ${newsletterId} not found`);
  const clean = (xs?: string[]) => xs?.map((x) => String(x).trim()).filter(Boolean);
  const memory = { ...nl.memory };
  if (patch.likes) memory.likes = clean(patch.likes)!;
  if (patch.dislikes) memory.dislikes = clean(patch.dislikes)!;
  if (typeof patch.notes === "string") memory.notes = patch.notes.trim();
  // Only removals are accepted for history: the reader can make it forget, not invent.
  if (patch.covered) {
    const keep = new Set(patch.covered.map((c) => c.key));
    memory.covered = memory.covered.filter((c) => keep.has(c.key));
  }
  const updated = { ...nl, memory };
  await store.saveNewsletter(updated);
  return updated;
}

/** Turns scheduled, automatic issues on or off for one newsletter. */
export async function setAutoIssues(newsletterId: string, on: boolean, store: Store = defaultStore): Promise<Newsletter> {
  const nl = await store.getNewsletter(newsletterId);
  if (!nl) throw new Error(`Newsletter ${newsletterId} not found`);
  const updated = { ...nl, autoIssues: on };
  await store.saveNewsletter(updated);
  return updated;
}

const cleanStyle = (s: Partial<Style>): Style => normalizeStyle(s);

/** Days of the week and hour. The cadence label follows, for older code paths and the planner. */
export async function setDelivery(newsletterId: string, delivery: Partial<Delivery>, store: Store = defaultStore): Promise<Newsletter> {
  const nl = await store.getNewsletter(newsletterId);
  if (!nl) throw new Error(`Newsletter ${newsletterId} not found`);
  const d = cleanDelivery({ ...deliveryOf(nl), ...delivery });
  const updated: Newsletter = { ...nl, delivery: d, profile: { ...nl.profile, cadence: gapDays(d) <= 2 ? "daily" : "weekly" } };
  await store.saveNewsletter(updated);
  return updated;
}

/**
 * Pause: nothing is written or sent, and nothing is lost. Subscriptions keep arriving in the
 * inbox. `until` (YYYY-MM-DD) resumes by itself on that day.
 */
export async function pause(newsletterId: string, until?: string, store: Store = defaultStore): Promise<Newsletter> {
  const nl = await store.getNewsletter(newsletterId);
  if (!nl) throw new Error(`Newsletter ${newsletterId} not found`);
  const valid = until && /^\d{4}-\d{2}-\d{2}$/.test(until) ? until : undefined;
  const updated = { ...nl, pausedAt: nl.pausedAt ?? new Date().toISOString(), pausedUntil: valid };
  await store.saveNewsletter(updated);
  return updated;
}

/**
 * Resume. `catchUp`: the next issue covers everything since the last one (the best of what
 * was missed, still one issue). Otherwise it starts fresh, as if the pause never happened:
 * only the usual window before today.
 */
export async function resume(newsletterId: string, catchUp: boolean, store: Store = defaultStore): Promise<Newsletter> {
  const nl = await store.getNewsletter(newsletterId);
  if (!nl) throw new Error(`Newsletter ${newsletterId} not found`);
  const d = deliveryOf(nl);
  const today = dateIn(d.timezone);
  const updated: Newsletter = {
    ...nl,
    pausedAt: undefined,
    pausedUntil: undefined,
    windowFloor: catchUp ? undefined : addDays(today, -(gapDays(d) + 1)),
  };
  await store.saveNewsletter(updated);
  return updated;
}

const bareDomain = (d: string) => d.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();

/**
 * Trust or block a site. Trusted sites get their own search every issue and, when they publish
 * a feed (most blogs, Substack, news sites), their new posts are read directly too. One list
 * for the reader, two mechanisms underneath.
 */
export async function addSite(newsletterId: string, site: string, list: "domains" | "blockedDomains", store: Store = defaultStore) {
  const nl = await store.getNewsletter(newsletterId);
  if (!nl) throw new Error(`Newsletter ${newsletterId} not found`);
  const d = bareDomain(site);
  const other = list === "domains" ? "blockedDomains" : "domains";
  const p = nl.profile;
  let updated = await updateProfile(newsletterId, {
    [list]: [...new Set([...(p[list] ?? []), d])],
    [other]: (p[other] ?? []).filter((x) => x !== d),
  }, store);
  if (list === "domains") {
    await addFeed(newsletterId, site, "feed").catch(() => null); // no feed: searched only
  } else {
    await removeSite(newsletterId, d, store, false);
    updated = (await store.getNewsletter(newsletterId))!;
  }
  return updated;
}

export async function removeSite(newsletterId: string, site: string, store: Store = defaultStore, fromLists = true) {
  const d = bareDomain(site);
  for (const s of await listSubscriptions(newsletterId)) {
    if (s.kind === "feed" && s.url && (hostOf(s.url) === d || hostOf(s.url).endsWith(`.${d}`)) && !s.url.includes("youtube.com")) await removeSubscription(newsletterId, s.id);
  }
  const nl = await store.getNewsletter(newsletterId);
  if (!nl) throw new Error(`Newsletter ${newsletterId} not found`);
  if (!fromLists) return nl;
  return updateProfile(newsletterId, {
    domains: nl.profile.domains.filter((x) => x !== d),
    blockedDomains: (nl.profile.blockedDomains ?? []).filter((x) => x !== d),
  }, store);
}
