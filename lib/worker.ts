import { q } from "./db";
import { BudgetExceeded } from "./budget";
import { runIssue } from "./service";
import { store } from "./store";
import type { Newsletter } from "./core/types";

/**
 * The scheduled worker: writes every automatic newsletter whose next issue is due.
 * It runs anywhere the code runs: `npm run worker` locally, or as a Nebius Serverless Job
 * launched on a schedule. Work stops as soon as the daily spending cap is reached.
 */

const CADENCE_DAYS = { daily: 1, weekly: 7 } as const;
const TZ = process.env.BUDGET_TZ ?? "Europe/Madrid";

export function todayIn(tz = TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function nextIssueDate(nl: Newsletter): string {
  if (!nl.lastIssueDate) return todayIn();
  const d = new Date(`${nl.lastIssueDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + CADENCE_DAYS[nl.profile.cadence]);
  return d.toISOString().slice(0, 10);
}

export async function dueNewsletters(today = todayIn()) {
  return (await store.listNewsletters()).filter((nl) => nl.autoIssues && nextIssueDate(nl) <= today);
}

export type WorkerRun = { id: number; startedAt: string; finishedAt?: string; trigger: string; status: string; summary?: string };

export async function runDue(trigger: "cli" | "web" | "nebius-job", log: (m: string) => void = () => {}) {
  const run = (await q<{ id: string }>("insert into worker_runs (trigger) values ($1) returning id", [trigger])).rows[0];
  const lines: string[] = [];
  const note = (m: string) => {
    lines.push(m);
    log(m);
  };
  let status = "done";
  try {
    const due = await dueNewsletters();
    note(due.length ? `${due.length} due: ${due.map((n) => n.profile.name).join(", ")}` : "nothing due");
    for (const nl of due) {
      try {
        const issue = await runIssue(nl.id, (step, detail) => log(`  ${nl.profile.name}: ${step}${detail ? ` (${detail})` : ""}`));
        note(`${nl.profile.name}: issue ${issue.number}, ${issue.stories.length} stories, $${issue.trace.totals.costUsd.toFixed(3)}`);
      } catch (err) {
        if (err instanceof BudgetExceeded) {
          note(`stopped: ${err.message}`);
          break;
        }
        status = "failed";
        note(`${nl.profile.name}: failed: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    status = "failed";
    note(`failed: ${(err as Error).message}`);
  } finally {
    await q("update worker_runs set finished_at = now(), status = $2, summary = $3 where id = $1", [run.id, status, lines.join("\n")]);
  }
  return { id: Number(run.id), status, summary: lines };
}

export async function recentRuns(limit = 5): Promise<WorkerRun[]> {
  const r = await q<{ id: string; started_at: Date; finished_at: Date | null; trigger: string; status: string; summary: string | null }>(
    "select * from worker_runs order by id desc limit $1",
    [limit],
  );
  return r.rows.map((x) => ({
    id: Number(x.id),
    startedAt: x.started_at.toISOString(),
    finishedAt: x.finished_at?.toISOString(),
    trigger: x.trigger,
    status: x.status,
    summary: x.summary ?? undefined,
  }));
}
