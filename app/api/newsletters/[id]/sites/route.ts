import { denyWithoutAccess } from "@/lib/access";
import { addSite, removeSite } from "@/lib/service";

/** A site you trust: searched every issue and, when it has a feed, followed. */
export async function POST(request: Request, ctx: RouteContext<"/api/newsletters/[id]/sites">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  const { site, list } = (await request.json()) as { site?: string; list?: "domains" | "blockedDomains" };
  if (!site?.trim()) return Response.json({ error: "Add a site" }, { status: 400 });
  try {
    return Response.json(await addSite(id, site, list ?? "domains"));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/newsletters/[id]/sites">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  const site = new URL(request.url).searchParams.get("site") ?? "";
  return Response.json(await removeSite(id, site));
}
