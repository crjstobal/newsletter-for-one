import { cookies } from "next/headers";
import { ACCESS_COOKIE, ACCESS_COOKIE_OPTIONS, isAccessCode } from "@/lib/access";

/**
 * The judges' link: /try/<code> unlocks the demo in this browser, then opens the home page.
 * A wrong code still lands on the home page, read-only, so the link never shows an error.
 */
export async function GET(request: Request, ctx: RouteContext<"/try/[code]">) {
  const { code } = await ctx.params;
  if (isAccessCode(code)) (await cookies()).set(ACCESS_COOKIE, code.trim(), ACCESS_COOKIE_OPTIONS);
  return Response.redirect(new URL("/", request.url), 302);
}
