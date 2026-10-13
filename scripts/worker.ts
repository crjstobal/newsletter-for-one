/**
 * Entry point of the scheduled worker. Run once and exit: `npm run worker`.
 * In production this is the command of the Nebius Serverless Job (see .github/workflows/schedule.yml).
 */
import { runDue, runOne } from "../lib/worker";
import { pool } from "../lib/db";

const trigger = process.env.NFO_TRIGGER === "nebius-job" ? "nebius-job" : "cli";

// NFO_NEWSLETTER: write just that newsletter now ("Write one now" on the web). Otherwise: everything due.
const only = process.env.NFO_NEWSLETTER?.trim();
(only ? runOne(only, trigger, (m) => console.log(m)) : runDue(trigger, (m) => console.log(m)))
  .then(async (r) => {
    await (await pool()).end();
    process.exit(r.status === "failed" ? 1 : 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
