import type { LLM } from "./ports";
import type { Profile } from "./types";

const SYSTEM = `You set up personal newsletters. A reader describes, in their own words, the
newsletter they wish existed. Turn that into a precise brief that a research agent can execute
every issue.

Think about who this reader really is and what they would consider news: releases, updates,
new tools, techniques, deals, community discoveries, events. Fill in what they left implicit,
but never contradict what they said.

Return JSON with exactly these fields:
{
  "name": string,            // short, catchy newsletter name
  "topic": string,           // one sentence
  "audience": string,        // who the reader is, inferred
  "language": string,        // ISO 639-1 code the issue is written in: the reader's language
  "searchLanguages": string[], // ISO 639-1 codes where the best sources on this topic are
                             // published. Usually includes "en"; add a local language only
                             // when the topic is local (a region, a country's laws, local events)
  "cadence": "daily" | "weekly",  // weekly unless the topic moves fast enough for daily
  "storyCount": number,      // 3 to 8
  "tone": string,
  "mustCover": string[],     // 3 to 6 kinds of stories this reader wants
  "avoid": string[],         // things that would waste their time
  "coreQuery": string,       // 2 to 4 words naming the subject as people search for it ("Final Cut Pro")
  "watchlist": string[],     // 8 to 15 names worth following in this niche: companies, products,
                             // tools, creators, events, publications. Where the news comes from.
  "domains": string[],       // up to 6 official or primary-source domains, bare hostnames
  "subreddits": string[],    // up to 3 relevant subreddits, without the r/ prefix
  "youtube": boolean         // true if video tutorials/reviews are central to this topic
}`;

export async function buildProfile(llm: LLM, description: string, language?: string): Promise<Profile> {
  const request = language
    ? `${description}\n\n(The issues must be written in the language with ISO 639-1 code "${language}".)`
    : description;
  const p = await llm.json<Profile>("planner", [
    { role: "system", content: SYSTEM },
    { role: "user", content: request },
  ], { note: "build brief" });
  return {
    ...p,
    language: language || p.language || "en",
    searchLanguages: p.searchLanguages?.length ? p.searchLanguages : ["en"],
    storyCount: Math.min(8, Math.max(3, Number(p.storyCount) || 5)),
    cadence: p.cadence === "daily" ? "daily" : "weekly",
    domains: (p.domains ?? []).slice(0, 6),
    blockedDomains: [],
    coreQuery: p.coreQuery?.trim() || p.name,
    watchlist: (p.watchlist ?? []).map((w) => String(w).trim()).filter(Boolean).slice(0, 20),
    subreddits: (p.subreddits ?? []).map((s) => s.replace(/^r\//, "")).slice(0, 3),
    mustCover: p.mustCover ?? [],
    avoid: p.avoid ?? [],
  };
}
