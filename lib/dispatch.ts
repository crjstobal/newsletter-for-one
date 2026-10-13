import { q } from "./db";
import { budgetStatus } from "./budget";

/**
 * In production, "Write one now" hands the work to a Nebius Serverless Job: the web app asks
 * GitHub Actions to run the schedule workflow for one newsletter, and the page polls until the
 * issue appears. Locally (no GH_DISPATCH_TOKEN) the issue is written inside the request instead.
 */
export const dispatchEnabled = () => Boolean(process.env.GH_DISPATCH_TOKEN);

const REPO = process.env.GH_REPO ?? "crjstobal/newsletter-for-one";
const WORKFLOW = "schedule.yml";
/** A queued request older than this is considered lost and may be sent again. */
const QUEUE_TTL_MINUTES = 20;

export async function dispatchIssue(newsletterId: string): Promise<{ queued: boolean; already?: boolean }> {
  const pending = await q(
    `select 1 from worker_runs where trigger = 'web-queued' and summary = $1 and status = 'queued'
       and started_at > now() - ($2 || ' minutes')::interval`,
    [newsletterId, String(QUEUE_TTL_MINUTES)],
  );
  if (pending.rowCount) return { queued: true, already: true };

  const budget = await budgetStatus();
  if (budget.leftEur < budget.issueEstimateEur) {
    throw new Error(`Not enough of today's budget left (€${budget.spentEur.toFixed(2)} of €${budget.capEur.toFixed(2)} used). It resets at midnight, Madrid time.`);
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GH_DISPATCH_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: "main", inputs: { newsletter: newsletterId } }),
  });
  if (!res.ok) throw new Error(`Couldn't start the Nebius job (GitHub ${res.status}): ${(await res.text()).slice(0, 200)}`);
  await q("insert into worker_runs (trigger, status, summary) values ('web-queued', 'queued', $1)", [newsletterId]);
  return { queued: true };
}
