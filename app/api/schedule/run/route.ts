import { q } from "@/lib/db";
import { runDue } from "@/lib/worker";

/** Starts the scheduled worker now, in the background. Same code a Nebius Job runs. */
export async function POST() {
  const running = await q("select 1 from worker_runs where status = 'running' and started_at > now() - interval '2 hours'");
  if (running.rowCount) return Response.json({ error: "The worker is already running." }, { status: 409 });
  void runDue("web", (m) => console.log(`[worker] ${m}`));
  return Response.json({ started: true });
}
