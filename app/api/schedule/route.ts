import { budgetStatus } from "@/lib/budget";
import { nextIssueAt, recentRuns, todayIn } from "@/lib/worker";
import { store } from "@/lib/store";
import { describeDelivery, deliveryOf, isDue, isPaused } from "@/lib/core/schedule";

export async function GET() {
  const today = todayIn();
  const newsletters = (await store.listNewsletters()).map((nl) => ({
    id: nl.id,
    name: nl.profile.name,
    cadence: nl.profile.cadence,
    delivery: describeDelivery(deliveryOf(nl)),
    autoIssues: Boolean(nl.autoIssues),
    paused: isPaused(nl),
    pausedUntil: nl.pausedUntil,
    nextIssueAt: nextIssueAt(nl),
    due: isDue(nl),
  }));
  return Response.json({ today, budget: await budgetStatus(), newsletters, runs: await recentRuns() });
}
