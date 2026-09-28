import type { LLM } from "./ports";
import type { Issue, Profile, ReaderMemory } from "./types";

export const emptyMemory = (): ReaderMemory => ({ likes: [], dislikes: [], notes: "", covered: [] });

const SYSTEM = `You maintain a reader's preference model for their personal newsletter.
You receive the current model, the newsletter brief, and the reader's latest reactions: stories
they marked useful (up) or not useful (down), with an optional note in their own words.

Update the model so the next issue serves them better:
- "likes" and "dislikes": short, reusable preferences about kinds of stories, sources or angles
  (for example "hands-on plugin tutorials" or "no rumor pieces about unreleased versions").
  Generalize from the examples; do not just copy headlines. Merge duplicates, drop entries the
  new evidence contradicts. At most 10 each.
- "notes": at most 3 sentences on anything else worth remembering about this reader.

Return JSON: {"likes": string[], "dislikes": string[], "notes": string}`;

export type Reaction = { headline: string; summary: string; source: string; vote: "up" | "down"; note?: string };

export async function learnFromFeedback(
  llm: LLM,
  profile: Profile,
  memory: ReaderMemory,
  reactions: Reaction[],
): Promise<ReaderMemory> {
  if (reactions.length === 0) return memory;
  const out = await llm.json<{ likes: string[]; dislikes: string[]; notes: string }>("memory", [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: JSON.stringify({
        brief: { topic: profile.topic, audience: profile.audience },
        current: { likes: memory.likes, dislikes: memory.dislikes, notes: memory.notes },
        reactions,
      }),
    },
  ], { note: "learn from feedback" });
  return {
    ...memory,
    likes: (out.likes ?? memory.likes).slice(0, 10),
    dislikes: (out.dislikes ?? memory.dislikes).slice(0, 10),
    notes: out.notes ?? memory.notes,
  };
}

/** Everything a sent issue covered becomes part of the reader's history. */
export function rememberIssue(memory: ReaderMemory, issue: Issue): ReaderMemory {
  const known = new Set(memory.covered.map((c) => c.key));
  const added = issue.stories
    .filter((s) => !known.has(s.eventKey))
    .map((s) => ({ key: s.eventKey, headline: s.headline, date: issue.date, summary: s.summary, url: s.url }));
  return { ...memory, covered: [...memory.covered, ...added] };
}
