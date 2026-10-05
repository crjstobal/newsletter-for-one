import { denyWithoutAccess } from "@/lib/access";
import { ingestEmail, inboxAddress, listInbox } from "@/lib/subscriptions";
import { store } from "@/lib/store";
import { parseAddress } from "@/lib/adapters/email";

/** What arrived from subscriptions, newest first (bodies trimmed for the list). */
export async function GET(_request: Request, ctx: RouteContext<"/api/newsletters/[id]/inbox">) {
  const { id } = await ctx.params;
  const items = await listInbox(id);
  return Response.json(items.map(({ content, links, extracted, ...rest }) => ({
    ...rest,
    preview: content.slice(0, 240),
    chars: content.length,
    links: links.length,
    pieces: extracted?.length,
  })));
}

/**
 * Paste an email by hand: the same path a real inbound email takes, without needing DNS.
 * Handy for trying the inbox locally and for newsletters received elsewhere.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/newsletters/[id]/inbox">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  const nl = await store.getNewsletter(id);
  if (!nl) return Response.json({ error: "Not found" }, { status: 404 });
  const { from, subject, body } = (await request.json()) as { from?: string; subject?: string; body?: string };
  if (!from?.trim() || !body?.trim()) return Response.json({ error: "Add who it's from and the email itself" }, { status: 400 });
  const sender = parseAddress(from.includes("@") ? from : `${from} <${from.toLowerCase().replace(/[^a-z0-9]+/g, "")}@pasted.local>`);
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(body);
  const r = await ingestEmail({
    to: [inboxAddress(nl.inboxToken!)],
    from: sender.address,
    fromName: sender.name || from.trim(),
    subject: subject?.trim() || "(no subject)",
    html: isHtml ? body : undefined,
    text: isHtml ? undefined : body,
    date: new Date().toISOString().slice(0, 10),
  });
  return Response.json(r);
}
