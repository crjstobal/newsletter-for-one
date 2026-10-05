/**
 * The contracts the core depends on. The core never imports a vendor adapter directly:
 * adapters (Nebius Token Factory, Tavily) implement these interfaces and are injected.
 */
import type { ExtractedItem, InboxItem, Origin, TraceLLMCall, TraceSearch } from "./types";

export type Role = "planner" | "triage" | "dedup" | "editor" | "memory" | "extract";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export interface LLM {
  /** Returns parsed JSON produced by the model assigned to `role`. */
  /**
   * `thinking: false` turns the model's reasoning off: about 100x fewer output tokens on
   * mechanical jobs (splitting a newsletter into items). Never for judgment calls like "is this
   * the same news?", where it measurably gets answers wrong.
   */
  json<T>(role: Role, messages: ChatMessage[], opts?: { maxTokens?: number; note?: string; thinking?: boolean }): Promise<T>;
  /** Model id assigned to each role, for reporting. */
  models: Record<Role, string>;
}

export type SearchKind = "web" | "news" | "reddit" | "youtube" | "sources";

export type SearchRequest = {
  query: string;
  kind: SearchKind;
  why: string;
  since: string; // YYYY-MM-DD
  maxResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  language?: string; // ISO 639-1: only results in this language
};

export type SearchHit = {
  url: string;
  title: string;
  content: string;
  publishedDate?: string; // YYYY-MM-DD when known
  score?: number;
  origin?: Origin; // default "web"
  via?: string; // subscription name, for items from the reader's own subscriptions
};

export interface Search {
  search(req: SearchRequest): Promise<SearchHit[]>;
}

/** `withinWindow`: no exact date, but the search engine's date filter vouches it is recent. */
/** `publisher`: who is behind the page on a platform (YouTube channel, subreddit); variety is per publisher. */
export type ResolvedDate = { date?: string; withinWindow?: boolean; note: string; image?: string; publisher?: string };

/**
 * Reads what a page says about itself: its real publication date and the preview image it
 * publishes (og:image, video thumbnail). One request per URL, cached.
 */
export interface DateResolver {
  resolve(url: string): Promise<ResolvedDate>;
}

/**
 * The reader's own subscriptions (newsletters by email, podcasts, feeds). `collect` refreshes
 * the feeds and returns everything received in the window; `saveExtraction` caches the split
 * of an item into separate news, so a long email is only read once.
 */
export interface Subscriptions {
  collect(since: string): Promise<{ items: InboxItem[]; errors: string[] }>;
  saveExtraction(itemId: string, items: ExtractedItem[]): Promise<void>;
}

/** Every external call is recorded here, so each issue carries a full account of its cost. */
export type Tracker = {
  llm: TraceLLMCall[];
  searches: TraceSearch[];
};

export const newTracker = (): Tracker => ({ llm: [], searches: [] });

/** Normalizes the date formats search engines return ("Tue, 11 Mar 2025 17:00:00 GMT", ISO...). */
export function toIsoDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

/** True when `url` is on `domain` or one of its subdomains. */
export const onDomain = (url: string, domain: string) => {
  const host = hostOf(url);
  const d = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();
  return host === d || host.endsWith(`.${d}`);
};
