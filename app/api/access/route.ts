import { cookies } from "next/headers";
import { ACCESS_COOKIE, ACCESS_COOKIE_OPTIONS, hasAccess, isAccessCode } from "@/lib/access";

export async function GET() {
  return Response.json({ access: await hasAccess(), required: Boolean(process.env.DEMO_ACCESS_CODE) });
}

/** Unlocks the demo for this browser for 30 days. */
export async function POST(request: Request) {
  const { code } = (await request.json().catch(() => ({}))) as { code?: string };
  if (!code || !isAccessCode(code)) {
    return Response.json({ error: "That code is not right" }, { status: 403 });
  }
  (await cookies()).set(ACCESS_COOKIE, code.trim(), ACCESS_COOKIE_OPTIONS);
  return Response.json({ access: true });
}
