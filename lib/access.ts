import { cookies } from "next/headers";

/**
 * The public demo: anyone can read, only people with the access code can spend money (create
 * newsletters, write issues, learn from votes). The code goes in the submission's testing
 * instructions. Without DEMO_ACCESS_CODE set (local development) everything is open.
 * The daily spending cap still applies on top.
 */
export const ACCESS_COOKIE = "n41_access";

/** Unlocks for 30 days. Shared by the code form and the judges' link (/try/<code>). */
export const ACCESS_COOKIE_OPTIONS = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30, path: "/" } as const;

export const isAccessCode = (code: string | undefined) => Boolean(process.env.DEMO_ACCESS_CODE) && code?.trim() === process.env.DEMO_ACCESS_CODE;

export async function hasAccess(): Promise<boolean> {
  const code = process.env.DEMO_ACCESS_CODE;
  if (!code) return true;
  return (await cookies()).get(ACCESS_COOKIE)?.value === code;
}

/** Returns a 401 response when the visitor has no access, otherwise null. */
export async function denyWithoutAccess(): Promise<Response | null> {
  if (await hasAccess()) return null;
  return Response.json(
    { error: "This is a read-only demo. Enter the access code to create newsletters and write issues.", locked: true },
    { status: 401 },
  );
}
