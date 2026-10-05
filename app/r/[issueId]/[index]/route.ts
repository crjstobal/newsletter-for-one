import { store } from "@/lib/store";
import { recordClick } from "@/lib/subscriptions";

/**
 * Story links go through here: the click is counted (what the reader actually opens teaches
 * the next issue), then the browser goes to the story's own URL. Only URLs stored in the issue
 * are ever redirected to, so this is not an open redirect.
 */
export async function GET(request: Request, ctx: RouteContext<"/r/[issueId]/[index]">) {
  const { issueId, index } = await ctx.params;
  const issue = await store.getIssue(issueId);
  const story = issue?.stories[Number(index)];
  if (!issue || !story) return new Response("Not found", { status: 404 });
  await recordClick(issue.newsletterId, issue.id, Number(index)).catch(() => {});
  return Response.redirect(new URL(story.url, request.url), 302);
}
