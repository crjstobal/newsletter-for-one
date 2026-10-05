import { denyWithoutAccess } from "@/lib/access";
import { addFeed, inboxAddress, listSubscriptions } from "@/lib/subscriptions";
import { store } from "@/lib/store";
import { FEATURES } from "@/lib/features";
import type { SubscriptionKind } from "@/lib/core/types";

export async function GET(_request: Request, ctx: RouteContext<"/api/newsletters/[id]/subscriptions">) {
  const { id } = await ctx.params;
  const nl = await store.getNewsletter(id);
  if (!nl) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ inboxAddress: inboxAddress(nl.inboxToken!), subscriptions: await listSubscriptions(id), features: FEATURES });
}

/** Follow a feed, a newsletter archive or a podcast by URL. */
export async function POST(request: Request, ctx: RouteContext<"/api/newsletters/[id]/subscriptions">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  const { url, kind } = (await request.json()) as { url?: string; kind?: SubscriptionKind };
  if (!url?.trim()) return Response.json({ error: "Paste a link" }, { status: 400 });
  if ((kind === "podcast" && !FEATURES.podcasts) || (kind === "newsletter" && !FEATURES.newsletters)) {
    return Response.json({ error: "Coming soon" }, { status: 403 });
  }
  try {
    return Response.json(await addFeed(id, url, kind));
  } catch (err) {
    return Response.json({ error: `Couldn't follow that link: ${(err as Error).message}` }, { status: 422 });
  }
}
