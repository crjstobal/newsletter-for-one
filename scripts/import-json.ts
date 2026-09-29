/** One-off: moves newsletters and issues from the old JSON files into Postgres. Idempotent. */
import { legacyFiles, store } from "../lib/store";
import { pool } from "../lib/db";

async function main() {
  const newsletters = await legacyFiles.newsletters();
  const issues = await legacyFiles.issues();
  for (const nl of newsletters) await store.saveNewsletter(nl);
  // Oldest first so numbers stay unique per newsletter.
  for (const i of issues.sort((a, b) => a.id.localeCompare(b.id))) await store.saveIssue(i);
  console.log(`imported ${newsletters.length} newsletters, ${issues.length} issues`);
  await (await pool()).end();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
