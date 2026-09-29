/**
 * Entry point of the scheduled worker. Run once and exit: `npm run worker`.
 * In production this is the command of the Nebius Serverless Job (see .github/workflows/schedule.yml).
 */
import { runDue } from "../lib/worker";
import { pool } from "../lib/db";

const trigger = process.env.NFO_TRIGGER === "nebius-job" ? "nebius-job" : "cli";

runDue(trigger, (m) => console.log(m))
  .then(async (r) => {
    await (await pool()).end();
    process.exit(r.status === "failed" ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
