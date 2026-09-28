/**
 * Local driver for the pipeline.
 *   npm run cli -- create "A weekly newsletter about Final Cut Pro plugins and updates"
 *   npm run cli -- issue <newsletterId>
 *   npm run cli -- vote <issueId> 0:up 2:down:"too basic"
 *   npm run cli -- list
 */
import { createNewsletter, giveFeedback, runIssue, type Vote } from "../lib/service";
import { fileStore } from "../lib/store";
import type { Issue } from "../lib/core/types";

function printIssue(issue: Issue) {
  console.log(`\n=== ${issue.subject} (${issue.date})${issue.quiet ? " [quiet]" : ""}`);
  console.log(issue.intro);
  issue.stories.forEach((s, i) => {
    console.log(`\n[${i}] ${s.headline}\n    ${s.summary}\n    Why it matters: ${s.whyItMatters}\n    ${s.url}`);
  });
  const tr = issue.trace;
  for (const st of tr.steps) console.log(`--- ${st.label} [${st.tool}] ${(st.ms / 1000).toFixed(1)}s $${st.costUsd.toFixed(4)}: ${st.summary}`);
  for (const c of tr.checks) console.log(`    ${c.level.toUpperCase()} ${c.message}`);
  console.log(`--- total $${tr.totals.costUsd.toFixed(4)} (Nebius $${tr.totals.nebiusUsd.toFixed(4)}, Tavily $${tr.totals.tavilyUsd.toFixed(4)}), ${(tr.totals.ms / 1000).toFixed(1)}s`);
  console.log(`--- issue id: ${issue.id}`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const log = (step: string, detail?: string) => console.log(`  > ${step}${detail ? `: ${detail}` : ""}`);

  if (cmd === "create") {
    const lang = args[0]?.startsWith("--lang=") ? args.shift()!.slice(7) : undefined;
    const nl = await createNewsletter(args.join(" "), lang);
    console.log(JSON.stringify(nl.profile, null, 2));
    console.log(`\nnewsletter id: ${nl.id}`);
  } else if (cmd === "issue") {
    printIssue(await runIssue(args[0], log));
  } else if (cmd === "vote") {
    const [issueId, ...raw] = args;
    const votes: Vote[] = raw.map((r) => {
      const [idx, vote, ...note] = r.split(":");
      return { storyIndex: Number(idx), vote: vote as "up" | "down", note: note.join(":") || undefined };
    });
    const nl = await giveFeedback(issueId, votes);
    console.log(JSON.stringify({ likes: nl.memory.likes, dislikes: nl.memory.dislikes, notes: nl.memory.notes }, null, 2));
  } else if (cmd === "list") {
    for (const nl of await fileStore.listNewsletters()) console.log(`${nl.id}  ${nl.profile.name}  (last: ${nl.lastIssueDate ?? "never"})`);
  } else {
    console.log("usage: create <description> | issue <newsletterId> | vote <issueId> idx:up|down[:note]... | list");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
