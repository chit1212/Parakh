// L1 on a new file: the buyer uploads a reply; it is parsed in code and read live by the real
// pipeline, with progress streamed. Stateless: the browser keeps the reading for its session.
import { MissingKeyError } from "@/lib/ai";
import { loadFile } from "@/lib/files";
import { callBudget, RateLimitedError, visitorOf } from "@/lib/guard";
import { vendorForSender } from "@/lib/inbox";
import { hashOf } from "@/lib/reader/call";
import { readReply } from "@/lib/reader/pipeline";
import { loadEvent } from "@/lib/rfq";
import { summarise } from "@/lib/summary";
import type { Reply } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 4 * 1024 * 1024; // Vercel's request limit on the free plan is about 4.5 MB

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("files") ?? []).filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return Response.json({ error: "Choose a file to upload." }, { status: 400 });
  if (files.reduce((a, f) => a + f.size, 0) > MAX_BYTES) return Response.json({ error: "Files over 4 MB cannot be read in this demo." }, { status: 413 });
  const ev = await loadEvent();
  const chosen = String(form?.get("vendorId") ?? "");
  const from = String(form?.get("from") ?? "") || null;

  const parsed = await Promise.all(files.map(async (f) => {
    const buf = Buffer.from(await f.arrayBuffer());
    return loadFile(f.name, `upload:${f.name}`, buf);
  }));
  // An uploaded .eml is the cover email; its sender identifies the vendor.
  const cover = parsed.find((f) => f.kind === "eml") ?? null;
  const rest = parsed.filter((f) => f !== cover);
  const sender = cover?.email?.from ?? from;
  const vendorId = ev.vendors.some((v) => v.id === chosen) ? chosen : vendorForSender(ev.vendors, sender)?.id ?? null;
  const reply: Reply = {
    id: `upload-${hashOf(...parsed.map((f) => f.name + f.bytes)).slice(0, 10)}`,
    receivedAt: new Date().toISOString(), from: sender, subject: cover?.email?.subject ?? null,
    cover, files: rest.length ? rest : [], vendorId, origin: "upload",
  };

  const enc = new TextEncoder();
  const budget = callBudget(visitorOf(req));
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      send({ type: "reply", reply: summarise(reply, ev) });
      try {
        const reading = await readReply(reply, ev, { fresh: true, beforeCall: budget, onProgress: (stage, detail) => send({ type: "progress", stage, detail }) });
        send({ type: "result", reading });
      } catch (e) {
        const blocked = e instanceof RateLimitedError || e instanceof MissingKeyError;
        send({ type: blocked ? "blocked" : "error", message: (e as Error).message });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
