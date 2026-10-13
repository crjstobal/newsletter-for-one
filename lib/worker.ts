import { q } from "./db";
import { BudgetExceeded } from "./budget";
import { resume, runIssue } from "./service";
import { dateIn, isDue, isPaused, nextSlot } from "./core/schedule";
import { store } from "./store";
import type { Newsletter } from "./core/types";

/**
 * The scheduled worker: writes every automatic newsletter whose next issue is due.
 * It runs anywhere the code runs: `npm run worker` locally, or as a Nebius Serverless Job
 * launched on a schedule. Work stops as soon as the daily spending cap is reached.
 */

const TZ = process.env.BUDGET_TZ ?? "Europe/Madrid";
/** Newsletters written at the same time by one worker run. */
const PARALLEL = Number(process.env.WORKER_PARALLEL ?? 3);

export const todayIn = (tz = TZ) => dateIn(tz);

/** Next delivery as an ISO instant (each newsletter has its own days, hour and time zone). */
export const nextIssueAt = (nl: Newsletter) => nextSlot(nl).toISOString();

/** Runs hourly: anything whose slot has arrived is due. Pauses that reached their end date resume first. */
export async function dueNewsletters(now = new Date()) {
  const all = await store.listNewsletters();
  for (const nl of all) {
    if (nl.pausedAt && !isPaused(nl, now)) Object.assign(nl, await resume(nl.id, false));
  }
  return all.filter((nl) => isDue(nl, now));
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
    // A few newsletters at a time: each issue spends most of its minutes waiting on the models.
    // The budget reservation is serialized in the database, so the cap still holds.
    let stopped = false;
    const queue = [...due];
    await Promise.all(Array.from({ length: Math.min(PARALLEL, queue.length) }, async () => {
      for (let nl = queue.shift(); nl && !stopped; nl = queue.shift()) {
        try {
          const issue = await runIssue(nl.id, (step, detail) => log(`  ${nl!.profile.name}: ${step}${detail ? ` (${detail})` : ""}`));
          note(`${nl.profile.name}: issue ${issue.number}, ${issue.stories.length} stories, $${issue.trace.totals.costUsd.toFixed(3)}`);
        } catch (err) {
          if (err instanceof BudgetExceeded) {
            stopped = true;
            note(`stopped: ${err.message}`);
            return;
          }
          status = "failed";
          note(`${nl.profile.name}: failed: ${(err as Error).message}`);
        }
      }
    }));
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

/**
 * One newsletter, now: what "Write one now" runs in production, inside a Nebius job launched
 * from the web through GitHub Actions (a web request can't wait the 5 minutes an issue takes).
 */
export async function runOne(newsletterId: string, trigger: "cli" | "web" | "nebius-job", log: (m: string) => void = () => {}) {
  const run = (await q<{ id: string }>("insert into worker_runs (trigger) values ($1) returning id", [trigger])).rows[0];
  await q("update worker_runs set status = 'handed-off', finished_at = now() where trigger = 'web-queued' and summary = $1 and status = 'queued'", [newsletterId]);
  let status = "done";
  let summary = "";
  try {
    const issue = await runIssue(newsletterId, (step, detail) => log(`  ${step}${detail ? ` (${detail})` : ""}`));
    summary = `${newsletterId}: issue ${issue.number}, ${issue.stories.length} stories, $${issue.trace.totals.costUsd.toFixed(3)}`;
  } catch (err) {
    status = "failed";
    summary = `${newsletterId}: failed: ${(err as Error).message}`;
  } finally {
    log(summary);
    await q("update worker_runs set finished_at = now(), status = $2, summary = $3 where id = $1", [run.id, status, summary]);
  }
  return { status, summary };
}
