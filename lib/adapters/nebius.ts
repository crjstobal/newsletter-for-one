import { getKey } from "../secrets";
import type { ChatMessage, LLM, Role, Tracker } from "../core/ports";

/**
 * Nebius Token Factory adapter (OpenAI-compatible chat completions).
 * Each pipeline role gets the NVIDIA Nemotron model that fits its cost/context profile.
 */
const BASE_URL = process.env.NEBIUS_BASE_URL ?? "https://api.tokenfactory.nebius.com/v1";

export const DEFAULT_MODELS: Record<Role, string> = {
  // 1M context at Nano pricing: reads the reader's whole history to plan searches.
  planner: process.env.MODEL_PLANNER ?? "nvidia/Nemotron-3_5-Lightning",
  // Cheapest and fastest: scores dozens of raw search hits per issue.
  triage: process.env.MODEL_TRIAGE ?? "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
  // 1M context: compares this issue's candidates against every story ever sent to the reader.
  dedup: process.env.MODEL_DEDUP ?? "nvidia/Nemotron-3_5-Lightning",
  // NVIDIA's frontier model where quality is visible to the reader: dedupes by event and writes.
  // Only ~30 short sources per issue, so it costs about one cent.
  editor: process.env.MODEL_EDITOR ?? "nvidia/Nemotron-3-Ultra-550b-a55b",
  // Long context again: folds reader feedback into a durable preference model.
  memory: process.env.MODEL_MEMORY ?? "nvidia/Nemotron-3_5-Lightning",
};

type Price = { prompt: number; completion: number }; // USD per token

let pricing: Promise<Record<string, Price>> | null = null;

/** Live per-token prices from Token Factory, fetched once per process. */
function loadPricing(key: string) {
  pricing ??= fetch(`${BASE_URL}/models?verbose=true`, { headers: { Authorization: `Bearer ${key}` } })
    .then((r) => r.json())
    .then((d: { data: { id: string; pricing?: { prompt: string; completion: string } }[] }) =>
      Object.fromEntries(
        d.data.map((m) => [m.id, { prompt: Number(m.pricing?.prompt ?? 0), completion: Number(m.pricing?.completion ?? 0) }]),
      ),
    )
    .catch(() => ({}));
  return pricing;
}

/** Models sometimes wrap JSON in fences or add prose around it. */
export function extractJSON<T>(text: string): T {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1)) as T;
    throw new Error(`Model did not return JSON: ${text.slice(0, 300)}`);
  }
}

export function nebiusLLM(tracker: Tracker, models: Record<Role, string> = DEFAULT_MODELS): LLM {
  async function call(role: Role, messages: ChatMessage[], maxTokens: number, note?: string) {
    const key = await getKey("nebius.env", "NEBIUS_API_KEY");
    const prices = await loadPricing(key);
    const t0 = Date.now();
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: models[role],
        messages,
        max_tokens: maxTokens,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) throw new Error(`Nebius ${models[role]} ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const promptTokens = data.usage?.prompt_tokens ?? 0;
    const completionTokens = data.usage?.completion_tokens ?? 0;
    const price = prices[models[role]] ?? { prompt: 0, completion: 0 };
    tracker.llm.push({
      role,
      model: models[role],
      promptTokens,
      completionTokens,
      costUsd: promptTokens * price.prompt + completionTokens * price.completion,
      ms: Date.now() - t0,
      note,
    });
    const content: string = data.choices?.[0]?.message?.content ?? "";
    if (!content && data.choices?.[0]?.finish_reason === "length") {
      throw new Error(`Nebius ${models[role]}: ran out of tokens while reasoning`);
    }
    return content;
  }

  return {
    models,
    async json<T>(role: Role, messages: ChatMessage[], opts?: { maxTokens?: number; note?: string }) {
      const maxTokens = opts?.maxTokens ?? 8000;
      try {
        return extractJSON<T>(await call(role, messages, maxTokens, opts?.note));
      } catch (err) {
        // One retry: reasoning models occasionally truncate or emit stray prose.
        console.warn(`[nebius] ${role} retry after: ${(err as Error).message.slice(0, 160)}`);
        return extractJSON<T>(await call(role, messages, maxTokens * 2, `${opts?.note ?? role} (retry)`));
      }
    },
  };
}
