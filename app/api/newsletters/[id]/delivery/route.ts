import { denyWithoutAccess } from "@/lib/access";
import { setDelivery } from "@/lib/service";
import type { Delivery } from "@/lib/core/types";

export async function PATCH(request: Request, ctx: RouteContext<"/api/newsletters/[id]/delivery">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    return Response.json(await setDelivery(id, (await request.json()) as Partial<Delivery>));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
