import { denyWithoutAccess } from "@/lib/access";
import { resetMemory } from "@/lib/service";

export async function POST(_request: Request, ctx: RouteContext<"/api/newsletters/[id]/reset">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  return Response.json(await resetMemory(id));
}
