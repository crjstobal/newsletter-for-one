import { cookies } from "next/headers";
import { ACCESS_COOKIE, hasAccess } from "@/lib/access";

export async function GET() {
  return Response.json({ access: await hasAccess(), required: Boolean(process.env.DEMO_ACCESS_CODE) });
}

/** Unlocks the demo for this browser for 30 days. */
export async function POST(request: Request) {
  const { code } = (await request.json().catch(() => ({}))) as { code?: string };
  if (!process.env.DEMO_ACCESS_CODE || code?.trim() !== process.env.DEMO_ACCESS_CODE) {
    return Response.json({ error: "That code is not right" }, { status: 403 });
  }
  (await cookies()).set(ACCESS_COOKIE, code.trim(), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" });
  return Response.json({ access: true });
}
