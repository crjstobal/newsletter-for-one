import { createNewsletter } from "@/lib/service";
import { fileStore } from "@/lib/store";

export async function GET() {
  const list = await fileStore.listNewsletters();
  return Response.json(list.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

export async function POST(request: Request) {
  const { description, language } = (await request.json()) as { description?: string; language?: string };
  if (!description?.trim()) return Response.json({ error: "Describe your newsletter" }, { status: 400 });
  try {
    return Response.json(await createNewsletter(description.trim(), language || undefined));
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
