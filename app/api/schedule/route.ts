import { budgetStatus } from "@/lib/budget";
import { nextIssueDate, recentRuns, todayIn } from "@/lib/worker";
import { store } from "@/lib/store";

export async function GET() {
  const today = todayIn();
  const newsletters = (await store.listNewsletters()).map((nl) => ({
    id: nl.id,
    name: nl.profile.name,
    cadence: nl.profile.cadence,
    autoIssues: Boolean(nl.autoIssues),
    nextIssueDate: nextIssueDate(nl),
    due: Boolean(nl.autoIssues) && nextIssueDate(nl) <= today,
  }));
  return Response.json({ today, budget: await budgetStatus(), newsletters, runs: await recentRuns() });
}
