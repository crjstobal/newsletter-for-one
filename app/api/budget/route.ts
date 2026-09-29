import { budgetStatus } from "@/lib/budget";

export async function GET() {
  return Response.json(await budgetStatus());
}
