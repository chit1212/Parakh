// Submitting an award to the VP (review fix 2.5). The server refuses while any blocker remains, so
// the rule holds even if the button is bypassed. Sending is stubbed: nothing leaves the app.
import { blockersOf, type Snapshot } from "@/lib/award";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { snapshot?: Snapshot } | null;
  const s = body?.snapshot;
  if (!s || !Array.isArray(s.rows)) return Response.json({ error: "No award to submit." }, { status: 400 });
  const blockers = blockersOf(s);
  if (blockers.length) return Response.json({ error: "Can’t submit yet.", blockers }, { status: 409 });
  return Response.json({ ok: true, sentAt: new Date().toISOString() });
}
