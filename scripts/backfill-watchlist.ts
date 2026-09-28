/** One-off: adds coreQuery and watchlist to newsletters created before those fields existed. */
import { nebiusLLM } from "../lib/adapters/nebius";
import { newTracker } from "../lib/core/ports";
import { fileStore } from "../lib/store";

async function main() {
  const tracker = newTracker();
  const llm = nebiusLLM(tracker);
  for (const nl of await fileStore.listNewsletters()) {
    if (nl.profile.watchlist?.length) continue;
    const out = await llm.json<{ coreQuery: string; watchlist: string[] }>("planner", [
      {
        role: "system",
        content:
          'For this newsletter brief return JSON {"coreQuery": string, "watchlist": string[]}. coreQuery: 2 to 4 words naming the subject as people search for it. watchlist: 8 to 15 names worth following in this niche (companies, products, tools, creators, events, publications): where the news comes from.',
      },
      { role: "user", content: JSON.stringify({ topic: nl.profile.topic, audience: nl.profile.audience, mustCover: nl.profile.mustCover, description: nl.description }) },
    ], { note: "backfill watchlist" });
    nl.profile.coreQuery = out.coreQuery;
    nl.profile.watchlist = out.watchlist;
    await fileStore.saveNewsletter(nl);
    console.log(nl.profile.name, "|", out.coreQuery, "|", out.watchlist.join(", "));
  }
  console.log(`$${tracker.llm.reduce((a, c) => a + c.costUsd, 0).toFixed(5)}`);
}
main();
