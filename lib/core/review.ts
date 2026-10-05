import type { LLM } from "./ports";

const SYSTEM = `You are the last check before a newsletter issue is sent. You receive the
drafted stories, ranked best first. Each one has the source it must be based on (title and text).

Flag a story when:
- "mismatch": the headline or summary describes something the source does not report (the
  writer mixed up two sources, or reported a different event than its source);
- "same-as": it is the same news as, or nearly the same as, a story ranked ABOVE it. Count as
  nearly the same: two routine updates from the same company's store or catalog in the same
  days, or two angles on one announcement with no new facts. Name that story's index.

Do not flag stories just for being minor. Most stories are fine.

Return JSON: {"flags": [{"index": number, "problem": "mismatch" | "same-as", "sameAs": number|null, "why": string}]}`;

export type ReviewFlag = { index: number; problem: "mismatch" | "same-as"; sameAs?: number; why: string; headline?: string; sameAsHeadline?: string };

/**
 * A cheap second opinion on the editor's draft (Nemotron 3 Nano, reasoning on: it is a
 * judgment call). Caught in testing: a headline about one Nintendo announcement linked to the
 * patch notes of another, next to a near-identical store update.
 */
export async function reviewDraft(
  llm: LLM,
  drafts: { headline: string; summary: string; source: { title: string; text: string } }[],
): Promise<ReviewFlag[]> {
  if (drafts.length < 2) return [];
  const out = await llm.json<{ flags: { index: number; problem: string; sameAs: number | null; why: string }[] }>(
    "triage",
    [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: JSON.stringify(drafts.map((d, i) => ({ index: i, headline: d.headline, summary: d.summary, sourceTitle: d.source.title, sourceText: d.source.text.slice(0, 600) }))),
      },
    ],
    { maxTokens: 8000, note: `review ${drafts.length} drafted stories` },
  );
  return (out.flags ?? [])
    .map((f) => ({ index: Number(f.index), problem: f.problem === "mismatch" ? "mismatch" as const : "same-as" as const, sameAs: f.sameAs ?? undefined, why: String(f.why ?? "") }))
    // A "same-as" must point at a story ranked above it, or it is not actionable.
    .filter((f) => Number.isInteger(f.index) && f.index >= 0 && f.index < drafts.length && (f.problem === "mismatch" || (f.sameAs !== undefined && f.sameAs < f.index)));
}
