import type { LLM } from "./ports";
import type { CoveredEvent } from "./types";
import type { Scored } from "./triage";

const SYSTEM = `You are the memory of a personal newsletter. Your only job is to stop the reader
from getting the same news twice.

You receive this issue's candidate sources and every story already sent to this reader.
Two items are the SAME NEWS when they report the same underlying fact or event, even if the
wording, outlet, language or format differs. Examples of the same news:
- a video announcing "Final Cut Pro 15.2" and an article about the 15.2 update;
- a launch post and a review of that launch published days later, when the review adds nothing
  materially new;
- two outlets covering the same jam results.
NOT the same news: different versions (15.1 vs 15.2), a different product from the same
company, or a genuine follow-up with new facts (a patch that fixes the release, final results
after preliminary ones). Mark follow-ups as new.

For every candidate return:
- "sentKey": the key of the already-sent story it repeats, or null.
- "sameAs": the id of another CANDIDATE in this list it repeats, or null. When several
  candidates are the same news, point the weaker ones at the best one (most primary, most
  complete); the best one gets null.
- "why": a few words, only when sentKey or sameAs is set.

Return JSON: {"items": [{"id": number, "sentKey": string|null, "sameAs": number|null, "why": string|null}]}`;

export type Verdict = { sentKey?: string; sameAs?: number; why?: string };

/**
 * Semantic duplicate check against the reader's whole history and within the issue.
 * The history fits in the model's context (hundreds of stories per newsletter per year), so the
 * model reads all of it; no retrieval step is needed at this scale.
 */
export async function checkMemory(llm: LLM, shortlist: Scored[], covered: CoveredEvent[]): Promise<Map<number, Verdict>> {
  const verdicts = new Map<number, Verdict>();
  if (shortlist.length === 0) return verdicts;

  const out = await llm.json<{ items: { id: number; sentKey: string | null; sameAs: number | null; why: string | null }[] }>(
    "dedup",
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify({
          alreadySent: covered.map((c) => ({ key: c.key, date: c.date, headline: c.headline, summary: c.summary ?? null })),
          candidates: shortlist.map((s) => ({ id: s.id, title: s.title, url: s.url, text: s.content.slice(0, 500) })),
        }),
      },
    ],
    { maxTokens: 12000, note: `compare ${shortlist.length} candidates with ${covered.length} sent stories` },
  );

  const ids = new Set(shortlist.map((s) => s.id));
  const keys = new Set(covered.map((c) => c.key));
  for (const it of out.items ?? []) {
    const id = Number(it.id);
    if (!ids.has(id)) continue;
    const sentKey = it.sentKey && keys.has(it.sentKey) ? it.sentKey : undefined;
    const sameAs = it.sameAs !== null && ids.has(Number(it.sameAs)) && Number(it.sameAs) !== id ? Number(it.sameAs) : undefined;
    if (sentKey || sameAs !== undefined) verdicts.set(id, { sentKey, sameAs, why: it.why ?? undefined });
  }
  return verdicts;
}
