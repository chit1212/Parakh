// L0 RFQ co-pilot: Gemini turns the buyer's words into edits to the draft RFQ, using tools.
// Stateless: the browser sends the current draft and applies the edits it gets back.
import type { Content, FunctionDeclaration } from "@google/genai";
import { gemini, MissingKeyError } from "@/lib/ai";
import { MODELS } from "@/lib/config";
import { callBudget, RateLimitedError, visitorOf } from "@/lib/guard";
import { QuotaError, withModels } from "@/lib/reader/call";
import type { DraftRfq, Edit } from "@/lib/rfqDraft";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOOLS: FunctionDeclaration[] = [
  { name: "update_line", description: "Change one field of an RFQ line.", parametersJsonSchema: { type: "object", properties: { lineId: { type: "string" }, field: { type: "string", enum: ["name", "size", "spec", "qty"] }, value: { type: "string", description: "New value; for qty, a whole number of boxes." } }, required: ["lineId", "field", "value"] } },
  { name: "add_line", description: "Add a new line (a new SKU).", parametersJsonSchema: { type: "object", properties: { name: { type: "string" }, size: { type: "string", description: "e.g. '300 x 200 x 150 mm (internal)'" }, spec: { type: "string", description: "board and print, e.g. '5-ply BC, 180/120/120/120/150 GSM, top 20 BF, flutes B+C, 1-colour flexo print'" }, qty: { type: "number" } }, required: ["name", "size", "spec", "qty"] } },
  { name: "remove_line", description: "Remove a line from the RFQ.", parametersJsonSchema: { type: "object", properties: { lineId: { type: "string" } }, required: ["lineId"] } },
  { name: "add_question", description: "Add a question to the quality questionnaire.", parametersJsonSchema: { type: "object", properties: { text: { type: "string" }, type: { type: "string", enum: ["Mandatory", "Scored"] } }, required: ["text", "type"] } },
  { name: "update_term", description: "Set a commercial term (payment, freight, validity, currency, delivery, or another named term).", parametersJsonSchema: { type: "object", properties: { key: { type: "string" }, value: { type: "string" } }, required: ["key", "value"] } },
];

export async function POST(req: Request) {
  const { draft, message, history } = (await req.json().catch(() => ({}))) as { draft?: DraftRfq; message?: string; history?: { role: "user" | "assistant"; text: string }[] };
  if (!draft || !message?.trim()) return Response.json({ error: "Say what to change." }, { status: 400 });
  const budget = callBudget(visitorOf(req));
  const system = `You help a category buyer edit a draft RFQ for corrugated boxes. Make the changes the buyer asks for by calling the tools, one call per change, then reply in one or two sentences saying what you changed. Use the buyer's line ids (L01...). Do not invent quantities or specs the buyer did not give; if something needed is missing, ask for it instead of guessing. Never do arithmetic beyond copying numbers the buyer gave.
Current draft (JSON): ${JSON.stringify({ lines: draft.lines.map((l) => [l.id, l.name, l.size, l.spec, l.qty]), questions: draft.questions.map((q) => [q.id, q.text, q.type]), terms: draft.terms })}`;
  const contents: Content[] = [...(history ?? []).slice(-6).map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] })), { role: "user", parts: [{ text: message }] }];
  const edits: Edit[] = [];
  try {
    let reply = "";
    let model: string = MODELS.reader;
    for (let step = 0; step < 4; step++) {
      budget();
      const { value: res, model: used } = await withModels("rfq", MODELS.reader, (m) =>
        gemini().models.generateContent({ model: m, contents, config: { systemInstruction: system, tools: [{ functionDeclarations: TOOLS }], maxOutputTokens: 2000 } }),
      );
      model = res.modelVersion ?? used;
      const calls = res.functionCalls ?? [];
      if (!calls.length) { reply = res.text ?? ""; break; }
      const turn = res.candidates?.[0]?.content;
      if (turn) contents.push(turn);
      for (const c of calls) edits.push({ op: c.name, ...(c.args ?? {}) } as Edit);
      contents.push({ role: "user", parts: calls.map((c) => ({ functionResponse: { name: c.name!, id: c.id, response: { result: "applied to the draft" } } })) });
    }
    return Response.json({ reply: reply || (edits.length ? "Done." : "I could not work out a change from that."), edits, model });
  } catch (e) {
    const calm = e instanceof QuotaError || e instanceof RateLimitedError || e instanceof MissingKeyError;
    return Response.json({ error: calm ? (e as Error).message : "Something went wrong. Nothing was changed; try again in a minute." }, { status: calm ? 429 : 500 });
  }
}
