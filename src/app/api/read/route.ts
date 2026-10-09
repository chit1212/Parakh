// Read one reply and stream progress as it goes (one JSON object per line).
import { calmMessage, MissingKeyError, QuotaBusyError } from "@/lib/ai";
import { callBudget, RateLimitedError, visitorOf } from "@/lib/guard";
import { loadDemoInbox } from "@/lib/inbox";
import { readReply } from "@/lib/reader/pipeline";
import { loadEvent } from "@/lib/rfq";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { replyId, fresh } = (await req.json().catch(() => ({}))) as { replyId?: string; fresh?: boolean };
  const [ev, inbox] = await Promise.all([loadEvent(), loadDemoInbox()]);
  const reply = inbox.find((r) => r.id === replyId);
  if (!reply) return Response.json({ error: "No such reply." }, { status: 404 });

  const enc = new TextEncoder();
  const budget = callBudget(visitorOf(req));
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const reading = await readReply(reply, ev, {
          fresh: Boolean(fresh),
          beforeCall: budget,
          onProgress: (stage, detail) => send({ type: "progress", stage, detail }),
        });
        // A refused, keyless or quota-limited read is reported as such, not as a broken file.
        if (reading.status === "error" && /API key|limit|quota/i.test(reading.error ?? "")) send({ type: "blocked", message: reading.error });
        send({ type: "result", reading });
      } catch (e) {
        const blocked = e instanceof RateLimitedError || e instanceof MissingKeyError || e instanceof QuotaBusyError;
        send({ type: blocked ? "blocked" : "error", message: calmMessage(e) });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
