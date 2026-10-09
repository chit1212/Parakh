// L14 / L13: the AI drafts the email for a doubt routed to a vendor; the buyer edits and approves.
// The draft sees only that vendor's own quote as read: one vendor's prices never reach another.
import { z } from "zod";
import { MissingKeyError } from "@/lib/ai";
import { MODELS } from "@/lib/config";
import { callBudget, RateLimitedError, visitorOf } from "@/lib/guard";
import { callStructured, QuotaError } from "@/lib/reader/call";
import { loadEvent } from "@/lib/rfq";

export const runtime = "nodejs";
export const maxDuration = 60;

const Draft = z.object({
  subject: z.string().describe("Email subject line, short, with the RFQ number."),
  body: z.string().describe("Plain-text email body, signed by the buyer. No prices other than this vendor's own."),
});

interface Req {
  vendorId: string;
  ask: string;
  title: string;
  /** This vendor's own lines as read: "L09 Electric kettle 1.5L: Rs 579.00 per 100 pcs, ex-works → ₹6.25 per box". */
  lines: string[];
  /** How the quote was read, in short lines (conversions, freight, terms). */
  howRead: string[];
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Req | null;
  if (!body?.vendorId || !body.ask) return Response.json({ error: "Nothing to draft." }, { status: 400 });
  const ev = await loadEvent();
  const v = ev.vendors.find((x) => x.id === body.vendorId);
  if (!v) return Response.json({ error: "Unknown vendor." }, { status: 400 });
  try {
    const r = await callStructured({
      step: "draft",
      model: MODELS.reader,
      system: `You draft short, polite, specific emails from a category buyer to one vendor about that vendor's own quotation.
Write in plain Indian business English. Open with "Here is how we read your quote" and 2-4 short lines summarising it (from HOW WE READ IT), then the one question (THE ASK), quoting the vendor's own figures where useful. Ask for a written reply. Put each paragraph and each summary line on its own line, with blank lines between paragraphs. Never mention any other vendor, other prices, rankings, or who is winning. Do not invent figures: use only those given. Sign as ${ev.buyer}, ${ev.buyerRole}, ${ev.buyerCo}.`,
      content: [{
        text: `RFQ ${ev.id}: ${ev.title}. To: ${v.contact}, ${v.name} <${v.email}>.
THE ASK: ${body.ask}
CONTEXT: ${body.title}
THEIR LINES CONCERNED (their own quote, as read):
${body.lines.slice(0, 40).join("\n")}
HOW WE READ IT:
${body.howRead.slice(0, 8).join("\n")}`,
      }],
      schema: Draft,
      effort: "low",
      maxTokens: 4000,
      beforeCall: callBudget(visitorOf(req)),
    });
    return Response.json({ to: `${v.contact} <${v.email}>`, ...r.data, model: r.model });
  } catch (e) {
    const calm = e instanceof QuotaError || e instanceof RateLimitedError || e instanceof MissingKeyError;
    return Response.json({ error: calm ? (e as Error).message : "The draft could not be written just now. Try again in a minute." }, { status: calm ? 429 : 500 });
  }
}
