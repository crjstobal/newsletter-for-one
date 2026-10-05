import { searchPodcasts } from "@/lib/adapters/feeds";

export async function GET(request: Request) {
  const term = new URL(request.url).searchParams.get("q")?.trim();
  if (!term) return Response.json([]);
  try {
    return Response.json(await searchPodcasts(term));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}
