import { denyWithoutAccess } from "@/lib/access";
import { refreshFeeds } from "@/lib/subscriptions";

export async function POST(_request: Request, ctx: RouteContext<"/api/newsletters/[id]/subscriptions/refresh">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  return Response.json({ errors: await refreshFeeds(id, true) });
}
