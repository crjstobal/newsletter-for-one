import { denyWithoutAccess } from "@/lib/access";
import { runIssue } from "@/lib/service";
import { dispatchEnabled, dispatchIssue } from "@/lib/dispatch";

export const maxDuration = 300;

/**
 * Production: hands the issue to a Nebius job and answers {queued: true} at once.
 * Local: produces the issue here and streams progress as newline-delimited JSON.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/newsletters/[id]/issues">) {
  const denied = await denyWithoutAccess();
  if (denied) return denied;
  const { id } = await ctx.params;
  if (dispatchEnabled()) {
    try {
      return Response.json(await dispatchIssue(id));
    } catch (err) {
      return Response.json({ error: (err as Error).message }, { status: 502 });
    }
  }
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
