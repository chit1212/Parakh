import { hasApiKey } from "@/lib/ai";
import { loadDemoInbox } from "@/lib/inbox";
import { loadEvent, loadHistory } from "@/lib/rfq";
import { loadSavedReadings } from "@/lib/saved";
import { summarise } from "@/lib/summary";

export const runtime = "nodejs";

export async function GET() {
  const [ev, inbox, history, saved] = await Promise.all([loadEvent(), loadDemoInbox(), loadHistory(), loadSavedReadings()]);
  return Response.json({
    event: ev,
    lastYear: history.lines,
    replies: inbox.map((r) => summarise(r, ev)),
    keyConfigured: hasApiKey(),
    saved,
  });
}
