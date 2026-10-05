import { denyWithoutAccess } from "@/lib/access";
import { runIssue } from "@/lib/service";

export const maxDuration = 300;

/** Produces an issue and streams progress as newline-delimited JSON. */
export async function POST(_request: Request, ctx: RouteContext<"/api/newsletters/[id]/issues">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const issue = await runIssue(id, (step, detail) => send({ type: "progress", step, detail }));
        send({ type: "done", issue });
      } catch (err) {
        send({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" } });
}
