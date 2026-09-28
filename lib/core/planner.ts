import type { LLM, SearchKind } from "./ports";
import type { Profile, ReaderMemory } from "./types";

export type PlannedQuery = { query: string; kind: SearchKind; why: string; lang?: string };

const SYSTEM = `You are the research planner of a personal newsletter. Before each issue you
decide what to search for on the web so the editor gets fresh, relevant material.

You receive the newsletter brief, what the reader has liked and disliked so far, the stories
already sent in past issues, today's date and the date the search window starts.

Plan 8 to 10 searches. Rules:
- News in a niche comes from its players. At least half of the searches must name specific
  entries from the brief's "watchlist" (a company, product, tool, creator or event) together
  with what would be news about them, for example "MotionVFX new plugin" or "FxFactory update".
  Rotate through the watchlist across issues instead of always picking the same names.
- Community searches (reddit) should look for announcements, releases and notable finds, not
  help requests.
- Aim at what is NEW since the window start: releases, updates, announcements, new tools,
  tutorials, discussions. Do not search for evergreen "best X" listicles.
- Lean toward what the reader liked; steer away from what they disliked.
- Do not re-search stories already covered unless looking for a genuine follow-up.
- The reader's preferred sources ("domains") already get their own dedicated search every
  issue, so spend your searches on discovering material elsewhere.
- Spread the searches so the issue can draw on different kinds of sites: official sites and
  changelogs, independent blogs, trade press, forums, communities and video. Never spend more
  than 2 searches on the same kind.
- Mix kinds:
    "news"    mainstream and trade press
    "web"     blogs, official sites, changelogs, forums
    "reddit"  community discussion (mention the subreddit in the query when useful)
    "youtube" new videos (only if the brief says video matters)
- Queries are short keyword strings as a person would type them, 3 to 8 words, no dates or
  years in them. Write each query in one of the brief's "searchLanguages", choosing the one
  where the best sources for that query live. This may differ from the language the issue is
  written in.

Return JSON: {"queries": [{"query": string, "kind": "news"|"web"|"reddit"|"youtube", "why": string, "lang": string}]}
"lang" is the ISO 639-1 code of the language the query is written in; results will be limited
to that language.`;

export async function planQueries(
  llm: LLM,
  profile: Profile,
  memory: ReaderMemory,
  today: string,
  since: string,
): Promise<PlannedQuery[]> {
  const context = {
    brief: profile,
    readerLikes: memory.likes,
    readerDislikes: memory.dislikes,
    readerNotes: memory.notes,
    alreadyCovered: memory.covered.map((c) => `${c.date}: ${c.headline}`),
    today,
    windowStart: since,
  };
  const out = await llm.json<{ queries: PlannedQuery[] }>("planner", [
    { role: "system", content: SYSTEM },
    { role: "user", content: JSON.stringify(context, null, 2) },
  ], { note: "plan searches" });
  const allowed: SearchKind[] = profile.youtube
    ? ["news", "web", "reddit", "youtube"]
    : ["news", "web", "reddit"];
  return (out.queries ?? [])
    .filter((q) => q.query && allowed.includes(q.kind))
    .map((q) => ({ ...q, lang: (profile.searchLanguages ?? ["en"]).includes(q.lang ?? "") ? q.lang : (profile.searchLanguages ?? ["en"])[0] }))
    .slice(0, 10);
}
