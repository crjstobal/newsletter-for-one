export type Cadence = "daily" | "weekly";

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
};

/** What has been learned about this reader across issues. */
export type ReaderMemory = {
  likes: string[];
  dislikes: string[];
  notes: string;
  covered: CoveredEvent[];
};

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
};

/** Where a publication date came from, from most to least trustworthy. */
export type DateOrigin = "search" | "page" | "window" | "model" | "none";

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
  key: "plan" | "search" | "triage" | "dates" | "filter" | "memory" | "edit";
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
};
