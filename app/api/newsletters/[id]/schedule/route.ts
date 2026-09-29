import { setAutoIssues } from "@/lib/service";

export async function PATCH(request: Request, ctx: RouteContext<"/api/newsletters/[id]/schedule">) {
  const { id } = await ctx.params;
  const { autoIssues } = (await request.json()) as { autoIssues?: boolean };
  try {
    return Response.json(await setAutoIssues(id, Boolean(autoIssues)));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
