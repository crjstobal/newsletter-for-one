import { resetMemory } from "@/lib/service";

export async function POST(_request: Request, ctx: RouteContext<"/api/newsletters/[id]/reset">) {
  const { id } = await ctx.params;
  return Response.json(await resetMemory(id));
}
