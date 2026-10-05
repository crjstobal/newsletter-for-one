import { denyWithoutAccess } from "@/lib/access";
import { store } from "@/lib/store";
import { readingSignals } from "@/lib/subscriptions";

export async function GET(_request: Request, ctx: RouteContext<"/api/newsletters/[id]">) {
  const { id } = await ctx.params;
  const newsletter = await store.getNewsletter(id);
  if (!newsletter) return Response.json({ error: "Not found" }, { status: 404 });
  const reads = await readingSignals(id).catch(() => []);
  return Response.json({ newsletter: { ...newsletter, memory: { ...newsletter.memory, reads } }, issues: await store.listIssues(id) });
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/newsletters/[id]">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  await store.deleteNewsletter(id);
  return Response.json({ ok: true });
}
