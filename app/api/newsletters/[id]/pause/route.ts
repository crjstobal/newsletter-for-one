import { denyWithoutAccess } from "@/lib/access";
import { pause } from "@/lib/service";

export async function POST(request: Request, ctx: RouteContext<"/api/newsletters/[id]/pause">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  const { until } = (await request.json().catch(() => ({}))) as { until?: string };
  try {
    return Response.json(await pause(id, until));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
