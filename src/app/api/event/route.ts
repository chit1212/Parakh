import { hasApiKey } from "@/lib/ai";
import { loadDemoInbox } from "@/lib/inbox";
import { loadEvent, loadHistory } from "@/lib/rfq";
import { summarise } from "@/lib/summary";

export const runtime = "nodejs";

export async function GET() {
  const [ev, inbox, history] = await Promise.all([loadEvent(), loadDemoInbox(), loadHistory()]);
  return Response.json({
    event: ev,
    lastYear: history.lines,
    replies: inbox.map((r) => summarise(r, ev)),
    keyConfigured: hasApiKey(),
  });
}
