import { parseInbound } from "@/lib/adapters/email";
import { ingestEmail } from "@/lib/subscriptions";

/**
 * Inbound email webhook. Point any inbound-email service (Postmark, SendGrid Inbound Parse,
 * Mailgun routes, a Cloudflare Email Worker) at /api/inbound/email?key=INBOUND_SECRET.
 * Accepts JSON or form data. Mail for addresses that match no newsletter is dropped.
 */
export async function POST(request: Request) {
  const secret = process.env.INBOUND_SECRET;
  const key = new URL(request.url).searchParams.get("key");
  if (secret ? key !== secret : process.env.NODE_ENV === "production") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const type = request.headers.get("content-type") ?? "";
  const payload = type.includes("json")
    ? ((await request.json()) as Record<string, unknown>)
    : Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]));
  const r = await ingestEmail(parseInbound(payload));
  if (!r) return Response.json({ ok: false, reason: "no newsletter for that address" }, { status: 200 });
  return Response.json({ ok: true, ...r });
}
