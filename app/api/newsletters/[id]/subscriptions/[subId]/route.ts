import { denyWithoutAccess } from "@/lib/access";
import { removeSubscription } from "@/lib/subscriptions";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/newsletters/[id]/subscriptions/[subId]">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id, subId } = await ctx.params;
  await removeSubscription(id, subId);
  return Response.json({ ok: true });
}
