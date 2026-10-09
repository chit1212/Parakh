// L15: draw the original file a value was read from, with the place highlighted (code finds it).
// Only files of the reply the value came from, or the buyer's own records, can be drawn.
import { loadDemoInbox } from "@/lib/inbox";
import { loadHistory } from "@/lib/rfq";
import { recordView, sourceView } from "@/lib/sourceview";
import type { SourceRef } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { replyId, source, valueText, value, lineId } = (await req.json().catch(() => ({}))) as {
    replyId?: string; source?: SourceRef; valueText?: string; value?: number; lineId?: string;
  };
  if (!replyId || !source?.file) return Response.json({ error: "Nothing to show." }, { status: 400 });
  const [inbox, history] = await Promise.all([loadDemoInbox(), loadHistory()]);
  const reply = inbox.find((r) => r.id === replyId);
  const file = reply && [...(reply.cover ? [reply.cover] : []), ...reply.files].find((f) => f.name.toLowerCase() === source.file.toLowerCase());
  if (file) return Response.json(await sourceView(file, source, { valueText, value }, lineId));
  if (source.file.toLowerCase() === history.file.toLowerCase()) return Response.json(recordView(history.file, history.sheets, source));
  return Response.json({ kind: "none", file: source.file, why: "That file is not part of this reply." });
}
