import { denyWithoutAccess } from "@/lib/access";
import { updateProfile } from "@/lib/service";
import type { Profile } from "@/lib/core/types";

export async function PATCH(request: Request, ctx: RouteContext<"/api/newsletters/[id]/profile">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    return Response.json(await updateProfile(id, (await request.json()) as Partial<Profile>));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
