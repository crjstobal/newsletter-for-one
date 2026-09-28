import { toIsoDate, type LLM, type SearchHit } from "./ports";
import type { DateOrigin } from "./types";
import type { Profile, ReaderMemory } from "./types";

export type Candidate = SearchHit & { id: number };

export type Scored = Candidate & {
  score: number;
  eventKey: string;
  publishedDate?: string;
  dateFrom: DateOrigin;
  lang?: string;
};

const SYSTEM = `You screen raw web search results for a personal newsletter. You are fast and
strict. For every item decide how valuable it is to THIS reader as news in THIS window.

Score 0 to 10:
- 8-10: genuinely new and squarely on topic (a release, update, launch, notable tutorial or
  discussion published inside the window).
- 5-7: on topic and recent, but minor.
- 0-4: off topic, evergreen/listicle, SEO filler, store or category pages, or clearly older
  than the window start.

Always score these low, however on-topic they look:
- help requests and troubleshooting questions ("my export is blurry", "new to X, help"): 0-3;
- generic "how to use X" pages, downloads, cracks, "latest version free download": 0-1;
- product documentation and support articles, unless they announce something new: 0-3;
- pages on unrelated domains that just repeat the topic's name (spam, scraped content): 0.

Also give each item an "eventKey": a short lowercase slug naming the underlying real-world
event or subject (for example "fcpx-11-2-release" or "motionvfx-mcamera-launch"). Items about
the same event MUST share the same eventKey, even if the wording differs.

Also give "lang": the ISO 639-1 code of the language the source itself is in. For a video,
use the spoken language when the title or description reveals it (for example "in Hindi",
"tutorial en español", non-Latin script), otherwise the language of the title.

If the text states when it was published, return that date as YYYY-MM-DD, else null. Never
guess from version numbers or from today's date.

Return JSON: {"items": [{"id": number, "score": number, "eventKey": string, "publishedDate": string|null, "lang": string}]}
Return one entry per input item.`;

const BATCH = 20;

export async function triage(
  llm: LLM,
  profile: Profile,
  memory: ReaderMemory,
  candidates: Candidate[],
  today: string,
  since: string,
): Promise<Scored[]> {
  const batches: Candidate[][] = [];
  for (let i = 0; i < candidates.length; i += BATCH) batches.push(candidates.slice(i, i + BATCH));

  const results = await Promise.all(
    batches.map(async (batch, b) => {
      const payload = {
        topic: profile.topic,
        wants: profile.mustCover,
        avoid: [...profile.avoid, ...memory.dislikes],
        today,
        windowStart: since,
        items: batch.map((c) => ({
          id: c.id,
          title: c.title,
          url: c.url,
          publishedDate: c.publishedDate ?? null,
          text: c.content.slice(0, 700),
        })),
      };
      const out = await llm.json<{ items: { id: number; score: number; eventKey: string; publishedDate: string | null; lang?: string }[] }>(
        "triage",
        [
          { role: "system", content: SYSTEM },
          { role: "user", content: JSON.stringify(payload) },
        ],
        { maxTokens: 12000, note: `score batch ${b + 1}/${batches.length} (${batch.length} results)` },
      );
      return out.items ?? [];
    }),
  );

  const byId = new Map(candidates.map((c) => [c.id, c]));
  return results.flat().flatMap((r) => {
    const c = byId.get(Number(r.id));
    if (!c) return [];
    return [{
      ...c,
      score: Number(r.score) || 0,
      eventKey: String(r.eventKey || `item-${c.id}`),
      lang: r.lang ? String(r.lang).toLowerCase().slice(0, 2) : undefined,
      publishedDate: c.publishedDate ?? toIsoDate(r.publishedDate),
      dateFrom: c.publishedDate ? "search" as const : toIsoDate(r.publishedDate) ? "model" as const : "none" as const,
    }];
  });
}
