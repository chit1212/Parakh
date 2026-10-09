import { hasApiKey } from "@/lib/ai";
import { loadDemoInbox } from "@/lib/inbox";
import { loadEvent, loadHistory } from "@/lib/rfq";
import { loadSavedReadings } from "@/lib/saved";
import { summarise } from "@/lib/summary";

export const runtime = "nodejs";

export async function GET() {
  const [ev, inbox, history] = await Promise.all([loadEvent(), loadDemoInbox(), loadHistory()]);
  const saved = await loadSavedReadings(inbox);
  return Response.json({
    event: ev,
    lastYear: history.lines,
    // The buyer's own records, so code in the browser can resolve "same as last year" too.
    historySheets: history.sheets,
    replies: inbox.map((r) => summarise(r, ev)),
    saved,
    keyConfigured: hasApiKey(),
  });
}
