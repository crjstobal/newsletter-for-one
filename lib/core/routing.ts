import type { Trace } from "./types";

type Price = { prompt: number; completion: number }; // USD per token

export type ModelUse = { model: string; roles: string[]; calls: number; promptTokens: number; completionTokens: number; costUsd: number; share: number };

/**
 * Who did what in an issue: model calls grouped by model, plus what the same calls would have
 * cost on the biggest model. The baseline reuses the real token counts, so it is a lower bound:
 * a bigger reasoning model usually spends more tokens, and takes longer, on the same job.
 */
export function routingSummary(trace: Trace, prices: Record<string, Price>, baselineModel: string) {
  const byModel = new Map<string, ModelUse>();
  for (const c of trace.llmCalls) {
    const m = byModel.get(c.model) ?? { model: c.model, roles: [], calls: 0, promptTokens: 0, completionTokens: 0, costUsd: 0, share: 0 };
    if (!m.roles.includes(c.role)) m.roles.push(c.role);
    m.calls++;
    m.promptTokens += c.promptTokens;
    m.completionTokens += c.completionTokens;
    m.costUsd += c.costUsd;
    byModel.set(c.model, m);
  }
  const actualUsd = trace.llmCalls.reduce((s, c) => s + c.costUsd, 0);
  const models = [...byModel.values()]
    .map((m) => ({ ...m, share: actualUsd ? m.costUsd / actualUsd : 0 }))
    .sort((a, b) => b.calls - a.calls);

  const base = prices[baselineModel];
  const baselineUsd = base
    ? trace.llmCalls.reduce((s, c) => s + c.promptTokens * base.prompt + c.completionTokens * base.completion, 0)
    : null;

  return { models, actualUsd, baselineUsd, baselineModel, times: baselineUsd && actualUsd ? baselineUsd / actualUsd : null };
}
