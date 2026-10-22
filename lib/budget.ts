import { q } from "./db";

/**
 * Daily spending cap across the whole app (web, CLI and scheduled worker).
 * Work reserves its estimated cost before starting and settles the real cost when done, so
 * concurrent runs can't jointly overshoot the cap.
 */
export const DAILY_CAP_EUR = Number(process.env.DAILY_CAP_EUR ?? 20);
/** Costs are measured in USD (provider prices); the cap is in EUR. */
export const EUR_PER_USD = Number(process.env.EUR_PER_USD ?? 0.86);
/** The day resets at midnight in this time zone. */
const TZ = process.env.BUDGET_TZ ?? "Europe/Madrid";

export const ESTIMATE_USD = { issue: 0.3, brief: 0.02, feedback: 0.02 } as const;
export type SpendKind = keyof typeof ESTIMATE_USD;

export class BudgetExceeded extends Error {
  constructor(public spentEur: number, public neededEur: number) {
    super(
      `Not enough of today's budget left: €${spentEur.toFixed(2)} of €${DAILY_CAP_EUR.toFixed(2)} used, ` +
        `and this needs about €${neededEur.toFixed(2)}. The budget resets at midnight (${TZ}).`,
    );
    this.name = "BudgetExceeded";
  }
}

export async function spentTodayUsd(): Promise<number> {
  const r = await q<{ usd: string }>(
    `select coalesce(sum(usd), 0) as usd from spend where at >= (date_trunc('day', now() at time zone $1) at time zone $1)`,
    [TZ],
  );
  return Number(r.rows[0].usd);
}

export async function budgetStatus() {
  const spentUsd = await spentTodayUsd();
  const spentEur = spentUsd * EUR_PER_USD;
  return { capEur: DAILY_CAP_EUR, spentEur, leftEur: Math.max(0, DAILY_CAP_EUR - spentEur), issueEstimateEur: ESTIMATE_USD.issue * EUR_PER_USD };
}

/** Reserves the estimated cost of a piece of work, or throws BudgetExceeded. Returns the reservation id. */
export async function reserve(kind: SpendKind, refs: { newsletterId?: string } = {}): Promise<number> {
  const estimate = ESTIMATE_USD[kind];
  // Serialize reservations so two concurrent checks can't both pass.
  const r = await q<{ id: string | null; spent: string }>(
    `with lock as (select pg_advisory_xact_lock(4242)),
          spent as (select coalesce(sum(usd), 0) as usd from spend, lock
                    where at >= (date_trunc('day', now() at time zone $1) at time zone $1)),
          ins as (insert into spend (kind, newsletter_id, usd)
                  select $2, $3, $4 from spent where (spent.usd + $4) * $5 <= $6
                  returning id)
     select (select id from ins) as id, (select usd from spent) as spent`,
    [TZ, kind, refs.newsletterId ?? null, estimate, EUR_PER_USD, DAILY_CAP_EUR],
  );
  const row = r.rows[0];
  if (!row.id) throw new BudgetExceeded(Number(row.spent) * EUR_PER_USD, estimate * EUR_PER_USD);
  return Number(row.id);
}

/** Replaces a reservation with what the work really cost. */
export async function settle(id: number, usd: number, refs: { issueId?: string } = {}) {
  await q("update spend set usd = $2, settled = true, issue_id = coalesce($3, issue_id) where id = $1", [id, usd, refs.issueId ?? null]);
}
