// L24: grade readings against the answer key. Test-only grading; readings come from the reader.
import type { ReplyReading } from "@/lib/reader/pipeline";
import { loadEvent, loadHistory } from "@/lib/rfq";
import { grade, loadKey } from "@/lib/scorecard";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { readings } = (await req.json()) as { readings: ReplyReading[] };
  return Response.json(grade(await loadEvent(), await loadKey(), readings, await loadHistory()));
}
