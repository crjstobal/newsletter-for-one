export type Cadence = "daily" | "weekly";

/** When issues arrive: days of the week (0 = Sunday) and the hour, in the reader's time zone. */
export type Delivery = { days: number[]; hour: number; timezone: string };

/**
 * How the issue reads. Length: "rundown" is headlines and links only; "straight" two or three
 * sentences; "dense" packed with facts; "deep" adds context. Voice is separate.
 */
export type StylePreset = "rundown" | "straight" | "dense" | "deep";
export type Voice = "neutral" | "playful";
export type Style = {
  preset: StylePreset; // length
  voice?: Voice;
  jokes: boolean; // one light line per story (not in a rundown)
  numbers: boolean; // unused for now (the visual summary was dropped 2026-10-05); kept so saved styles stay valid
  mindMap: boolean; // map of the issue: themes and stories
};

export const DEFAULT_STYLE: Style = { preset: "straight", voice: "neutral", jokes: false, numbers: false, mindMap: true };

/** Styles saved before length and voice were split ("playful", "brief") read as their new form. */
export function normalizeStyle(input?: Partial<Style>): Style {
  const s = input as (Omit<Partial<Style>, "preset"> & { preset?: string }) | undefined;
  const legacy = s?.preset === "playful" ? { preset: "straight" as const, voice: "playful" as const } : s?.preset === "brief" ? { preset: "rundown" as const } : {};
  const preset = (["rundown", "straight", "dense", "deep"] as const).find((p) => p === (legacy.preset ?? s?.preset)) ?? DEFAULT_STYLE.preset;
  return {
    preset,
    voice: (legacy as { voice?: Voice }).voice ?? (s?.voice === "playful" ? "playful" : "neutral"),
    jokes: typeof s?.jokes === "boolean" ? s.jokes : DEFAULT_STYLE.jokes,
    numbers: typeof s?.numbers === "boolean" ? s.numbers : DEFAULT_STYLE.numbers,
    mindMap: typeof s?.mindMap === "boolean" ? s.mindMap : DEFAULT_STYLE.mindMap,
  };
}

/** What the newsletter is about, derived from the reader's own words and editable by them. */
export type Profile = {
  name: string;
  topic: string;
  audience: string;
  language: string; // ISO 639-1, language the issue is written in
  searchLanguages: string[]; // languages where the best sources on this topic are published
  cadence: Cadence;
  storyCount: number;
  tone: string;
  mustCover: string[];
  avoid: string[];
  coreQuery?: string; // 2 to 4 words naming the subject, used to search trusted sites
  watchlist?: string[]; // companies, products, people and sites worth following by name
  domains: string[]; // preferred sources: searched directly every issue
  blockedDomains: string[]; // never searched, never used
  allowUndated?: boolean; // keep results whose date cannot be verified (default: drop them)
  subreddits: string[];
  youtube: boolean;
  style?: Style;
};

/** What has been learned about this reader across issues. */
export type ReaderMemory = {
  likes: string[];
  dislikes: string[];
  notes: string;
  covered: CoveredEvent[];
  reads?: ReadingSignal[]; // what the reader actually opens, from clicks (computed, not stored)
};

/** Opened vs shown, per theme or per publisher. Clicks are a weak, honest signal of interest. */
export type ReadingSignal = { by: "theme" | "publisher"; name: string; shown: number; opened: number };

/** A story already sent. Kept with enough context for a model to recognize the same news later. */
export type CoveredEvent = { key: string; headline: string; date: string; summary?: string; url?: string };

export type Story = {
  headline: string;
  shortTitle?: string; // 3 to 6 words, for maps and compact views
  summary: string;
  whyItMatters: string;
  url: string;
  source: string;
  publisher?: string; // the channel or community on a platform, e.g. "Primal Video (YouTube)"
  eventKey: string;
  publishedDate?: string;
  dateFrom?: DateOrigin;
  theme?: string; // short label grouping related stories in this issue
  image?: string; // preview image published by the source itself (never generated)
  feedback?: "up" | "down";
  origin?: Origin; // where the source came from: the open web or one of the reader's subscriptions
  via?: string; // the subscription it came from ("Stratechery", "Hard Fork podcast")
  alsoIn?: string[]; // other sources that reported the same news in this window
  alsoInLinks?: { name: string; url?: string }[]; // the same, with a link to each one's own report
  joke?: string; // only when the style asks for it
};

/** Where a candidate came from. Subscriptions are things the reader follows directly. */
export type Origin = "web" | "newsletter" | "podcast" | "feed";

/** A figure worth showing big, always quoted from a source. */
export type IssueNumber = { value: string; label: string; storyIndex?: number };

/** Where a publication date came from, from most to least trustworthy. */
export type DateOrigin = "search" | "page" | "received" | "window" | "model" | "none";

/** Why a search result did or did not make it into the issue. */
export type CandidateStatus =
  | "used" // became a story
  | "shortlisted" // passed every filter, the editor chose not to use it
  | "low-score" // triage scored it below the threshold
  | "too-old" // published before the window
  | "already-sent" // same news as a story in a past issue
  | "duplicate" // same news as a better source in this issue
  | "blocked" // domain is on the reader's block list
  | "wrong-language" // the source is not in any of the newsletter's search languages
  | "no-date" // no verifiable publication date, and the reader requires one
  | "unscored"; // triage did not return a score for it

export type TraceCandidate = {
  id: number;
  url: string;
  title: string;
  source: string;
  publishedDate?: string;
  dateFrom: DateOrigin;
  dateNote?: string; // how the date was verified, or why it could not be
  foundBy: number[]; // indexes into trace.searches
  score?: number;
  eventKey?: string;
  status: CandidateStatus;
  storyIndex?: number;
  sameAs?: string; // for already-sent / duplicate: what it repeats
  lang?: string; // language of the source, as judged by triage
  origin?: Origin;
  via?: string;
};

export type TraceSearch = {
  query: string;
  kind: string;
  why: string;
  params: { topic: string; since: string; includeDomains: string[]; excludeDomains: string[]; depth: string; language?: string };
  hits: number;
  credits: number;
  costUsd: number;
  ms: number;
  error?: string;
};

export type TraceLLMCall = {
  role: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  ms: number;
  note?: string;
};

export type TraceStep = {
  key: "plan" | "subscriptions" | "search" | "triage" | "dates" | "filter" | "memory" | "edit";
  label: string;
  tool: string;
  ms: number;
  costUsd: number;
  summary: string;
};

export type QualityCheck = { level: "ok" | "warn" | "bad"; message: string };

export type Trace = {
  window: { since: string; until: string };
  steps: TraceStep[];
  searches: TraceSearch[];
  candidates: TraceCandidate[];
  llmCalls: TraceLLMCall[];
  checks: QualityCheck[];
  totals: { costUsd: number; nebiusUsd: number; tavilyUsd: number; tavilyCredits: number; promptTokens: number; completionTokens: number; ms: number };
};

export type Issue = {
  id: string;
  newsletterId: string;
  number?: number; // 1 for the first issue of a newsletter
  date: string;
  subject: string;
  intro: string;
  stories: Story[];
  quiet: boolean;
  numbers?: IssueNumber[];
  trace: Trace;
};

export type Newsletter = {
  id: string;
  description: string;
  profile: Profile;
  memory: ReaderMemory;
  createdAt: string;
  lastIssueDate?: string;
  autoIssues?: boolean; // written automatically by the scheduled worker when due
  delivery?: Delivery;
  pausedAt?: string; // ISO timestamp; while set, nothing is written or sent
  pausedUntil?: string; // YYYY-MM-DD, resumes by itself on that day
  windowFloor?: string; // YYYY-MM-DD: after a pause without catch-up, never search before this
  inboxToken?: string; // the local part of the newsletter's inbox address
};

export type SubscriptionKind = "newsletter" | "podcast" | "feed";

/** Something the reader follows directly, besides the web searches. */
export type Subscription = {
  id: string;
  newsletterId: string;
  kind: SubscriptionKind;
  name: string;
  url?: string; // feed URL
  sender?: string; // email newsletters: From address
  site?: string;
  image?: string;
  addedAt: string;
  lastFetchedAt?: string;
  lastError?: string;
  itemCount?: number;
};

/** One thing received from a subscription: an email, an episode, a post. */
export type InboxItem = {
  id: string;
  newsletterId: string;
  subscriptionId?: string;
  kind: SubscriptionKind;
  sourceName: string;
  guid: string;
  title: string;
  url?: string;
  content: string;
  contentKind: "text" | "transcript" | "show-notes";
  links: { text: string; url: string }[];
  publishedAt: string; // YYYY-MM-DD
  receivedAt?: string;
  extracted?: ExtractedItem[];
};

/** One piece of news inside an inbox item (a newsletter covers many; a podcast discusses several). */
export type ExtractedItem = { title: string; summary: string; url?: string };
