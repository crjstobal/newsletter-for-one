import { fileStore } from "@/lib/store";

export async function GET(_request: Request, ctx: RouteContext<"/api/newsletters/[id]">) {
  const { id } = await ctx.params;
  const newsletter = await fileStore.getNewsletter(id);
  if (!newsletter) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ newsletter, issues: await fileStore.listIssues(id) });
}
