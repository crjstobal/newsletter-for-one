import { updateMemory } from "@/lib/service";
import type { ReaderMemory } from "@/lib/core/types";

export async function PATCH(request: Request, ctx: RouteContext<"/api/newsletters/[id]/memory">) {
  const { id } = await ctx.params;
  try {
    return Response.json(await updateMemory(id, (await request.json()) as Partial<ReaderMemory>));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
