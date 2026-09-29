import { nebiusLLM } from "./adapters/nebius";
import { tavilySearch } from "./adapters/tavily";
import { pageDates } from "./adapters/dates";
import { newTracker, type Tracker } from "./core/ports";
import type { Issue, Newsletter, Profile, ReaderMemory } from "./core/types";
import { buildProfile } from "./core/profile";
import { produceIssue, type Progress } from "./core/issue";
import { emptyMemory, learnFromFeedback, rememberIssue, type Reaction } from "./core/memory";
import { store as defaultStore, type Store } from "./store";
import { reserve, settle, type SpendKind } from "./budget";

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
  };
  await store.saveNewsletter(nl);
  return nl;
}

export async function runIssue(newsletterId: string, progress?: Progress, store: Store = defaultStore): Promise<Issue> {
  const nl = await store.getNewsletter(newsletterId);
  if (!nl) throw new Error(`Newsletter ${newsletterId} not found`);
  const issue = await metered("issue", newsletterId, (d) => produceIssue(d, nl, progress), (i) => i.id);
  issue.number = (await store.listIssues(newsletterId)).length + 1;
  await store.saveIssue(issue);
  await store.saveNewsletter({ ...nl, memory: rememberIssue(nl.memory, issue), lastIssueDate: issue.date });
  return issue;
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
