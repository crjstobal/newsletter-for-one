import { denyWithoutAccess } from "@/lib/access";
import { resume } from "@/lib/service";

export async function POST(request: Request, ctx: RouteContext<"/api/newsletters/[id]/resume">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  const { catchUp } = (await request.json().catch(() => ({}))) as { catchUp?: boolean };
  try {
    return Response.json(await resume(id, Boolean(catchUp)));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
