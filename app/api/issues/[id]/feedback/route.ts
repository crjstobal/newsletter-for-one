import { giveFeedback, type Vote } from "@/lib/service";

export async function POST(request: Request, ctx: RouteContext<"/api/issues/[id]/feedback">) {
  const { id } = await ctx.params;
  const { votes } = (await request.json()) as { votes: Vote[] };
  try {
    return Response.json(await giveFeedback(id, votes ?? []));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
