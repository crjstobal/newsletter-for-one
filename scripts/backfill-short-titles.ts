/** One-off: adds short titles to issues written before the editor produced them. Uses Nemotron Nano. */
import { promises as fs } from "fs";
import path from "path";
import { nebiusLLM } from "../lib/adapters/nebius";
import { newTracker } from "../lib/core/ports";
import type { Issue } from "../lib/core/types";

async function main() {
  const dir = path.join(process.cwd(), "data", "issues");
  const tracker = newTracker();
  const llm = nebiusLLM(tracker);
  for (const f of await fs.readdir(dir)) {
    const file = path.join(dir, f);
    const issue = JSON.parse(await fs.readFile(file, "utf8")) as Issue;
    if (issue.stories.every((s) => s.shortTitle)) continue;
    const out = await llm.json<{ titles: string[] }>("triage", [
      { role: "system", content: 'Shorten each headline to 3 to 6 words for a map of the issue. Same language, keep product names and versions, no trailing punctuation. Return JSON {"titles": string[]} in the same order.' },
      { role: "user", content: JSON.stringify(issue.stories.map((s) => s.headline)) },
    ], { note: "short titles" });
    issue.stories.forEach((s, i) => (s.shortTitle = out.titles?.[i] ?? s.shortTitle));
    await fs.writeFile(file, JSON.stringify(issue, null, 2));
    console.log(f, out.titles);
  }
  const cost = tracker.llm.reduce((a, c) => a + c.costUsd, 0);
  console.log(`done: ${tracker.llm.length} calls, $${cost.toFixed(5)}`);
}
main();
