// L25 analyst chat: Gemini with tools. The model chooses the rules; code runs every number.
import type { Content, FunctionDeclaration } from "@google/genai";
import { gemini, MissingKeyError } from "@/lib/ai";
import { cellKey } from "@/lib/compare";
import { MODELS } from "@/lib/config";
import { loadEventState } from "@/lib/event";
import { crore, lakh, where } from "@/lib/format";
import { callBudget, RateLimitedError, visitorOf } from "@/lib/guard";
import { QuotaError, withModels } from "@/lib/reader/call";
import { LIBRARY, runScenario, type ScenarioRules } from "@/lib/scenario";
import { qualityOf } from "@/lib/quality";
import { DEFAULT_SCHEME, schemeProblems, type QualityScheme } from "@/lib/qualityScheme";
import { loadDemoInbox } from "@/lib/inbox";
import { loadSavedReadings } from "@/lib/saved";

export const runtime = "nodejs";
export const maxDuration = 120;

interface Msg { role: "user" | "assistant"; text: string; asker?: string }

const RULES_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short label for this scenario, e.g. 'Quality-cleared, cheapest per line'." },
    eligible: { type: "string", enum: ["all", "quality_cleared"], description: "All vendors, or only those that cleared the quality questionnaire." },
    exclude: { type: "array", items: { type: "object", properties: { vendorId: { type: "string" }, reason: { type: "string" } }, required: ["vendorId", "reason"] }, description: "Vendors the user wants left out, with the user's reason." },
    assumeDiscounts: { type: "boolean", description: "Treat conditional discounts as applying." },
    freight: { type: "string", enum: ["as_read", "last_year"], description: "Where freight is unknown: leave it out, or add last year's freight." },
    acceptHeld: { type: "boolean", description: "Let substitute specs and prices far below should-cost win as quoted." },
    worstCase: { type: "boolean", description: "Price every open doubt against the buyer." },
    cap: { type: "number", description: "Maximum share of award value for any one vendor, 0 to 1 (e.g. 0.4)." },
    maxVendors: { type: "integer", description: "Award to at most this many vendors (e.g. 1 for a single vendor, 2 for two). Code tries every set of that size and picks the lowest total that covers every line." },
    overrides: { type: "array", items: { type: "object", properties: { lineId: { type: "string" }, vendorId: { type: "string" } }, required: ["lineId", "vendorId"] }, description: "Lines the user fixes to a vendor." },
  },
  required: ["title", "eligible"],
};

const TOOLS: FunctionDeclaration[] = [
  { name: "read_comparison", description: "The comparison as quoted: vendors (id, name, quality result and why), the winner and price per line, totals per vendor, and the open doubts. Call this first.", parametersJsonSchema: { type: "object", properties: {} } },
  { name: "run_scenario", description: "Solve a what-if in code and apply it to the buyer's table. Returns the total, the change against as quoted, the split by vendor, who was excluded and why, the rules applied and the lines that change hands. Use it for every what-if; never work numbers out yourself.", parametersJsonSchema: RULES_SCHEMA },
  { name: "get_cell_source", description: "Where one vendor's price for one line came from: as written, converted, the calculation, the source location and the checks.", parametersJsonSchema: { type: "object", properties: { vendorId: { type: "string" }, lineId: { type: "string" } }, required: ["vendorId", "lineId"] } },
  { name: "show_view", description: "Switch the buyer's view of the current scenario between the table and a chart.", parametersJsonSchema: { type: "object", properties: { view: { type: "string", enum: ["table", "chart"] } }, required: ["view"] } },
];

export async function POST(req: Request) {
  const { messages, scheme: asked } = (await req.json().catch(() => ({}))) as { messages?: Msg[]; scheme?: QualityScheme };
  if (!messages?.length) return Response.json({ error: "Ask a question." }, { status: 400 });
  const state = await loadEventState();
  const { ev, grid, report } = state;
  // The buyer's marking scheme, if it is a valid one; quality is re-marked against it in code.
  const scheme = asked && Array.isArray(asked.rules) && !schemeProblems(asked, ev.questions.map((x) => x.id)).length ? asked : DEFAULT_SCHEME;
  const quality = scheme === DEFAULT_SCHEME ? state.quality
    : await (async () => { const inbox = await loadDemoInbox(); const rs = Object.values(await loadSavedReadings(inbox)); return ev.vendors.map((v) => qualityOf(ev, v.id, rs, scheme)); })();
  const name = (v: string) => grid.vendors.find((x) => x.id === v)?.short ?? v;
  const budget = callBudget(visitorOf(req));
  const scenarios: (ScenarioRules & { title: string })[] = [];
  let view: "table" | "chart" | null = null;

  const tool = (fname: string, args: Record<string, unknown>): unknown => {
    if (fname === "read_comparison") {
      const a = grid.asQuoted;
      return {
        basis: "INR per box, delivered Chakan, GST extra. Conditional discounts are not applied; unknown freight is not added.",
        vendors: grid.vendors.map((v) => ({ id: v.id, name: v.name, short: v.short, format: v.format, quality: quality.find((q) => q.vendorId === v.id), linesWonAsQuoted: a.byVendor[v.id].lines, valueAsQuoted: lakh(a.byVendor[v.id].value) })),
        totalAsQuoted: crore(a.total),
        lines: ev.lines.map((l) => ({ id: l.id, name: l.name, qty: l.qty, winner: a.per[l.id] ? `${name(a.per[l.id]!.vendorId)} ₹${a.per[l.id]!.perBox.toFixed(2)}` : "none" })),
        openDoubts: report.raised.map((d) => ({ title: d.title, vendor: name(d.vendorId), lines: [...new Set(d.changes.map((c) => c.lineId))], atStake: lakh(d.stake), route: d.route })),
      };
    }
    if (fname === "run_scenario") {
      const rules = args as unknown as ScenarioRules & { title: string };
      const r = runScenario(ev, grid, quality, rules);
      scenarios.push(rules);
      const d = r.award.total - r.base.total;
      return {
        appliedToTable: rules.title,
        total: crore(r.award.total),
        vsAsQuoted: `${d >= 0 ? "+" : "−"}${lakh(Math.abs(d))} (${d >= 0 ? "+" : "−"}${Math.abs((d / r.base.total) * 100).toFixed(1)}%)`,
        split: grid.vendors.filter((v) => r.award.byVendor[v.id].lines).map((v) => `${v.short} ${r.award.byVendor[v.id].lines} lines, ${lakh(r.award.byVendor[v.id].value)}`),
        excluded: r.excluded.map((e) => `${e.name}: ${e.why}`),
        rulesApplied: r.rules,
        linesChangingHands: r.changed.map((c) => `${c.lineId} ${c.from ? name(c.from) : "none"} → ${c.to ? name(c.to) : "none"} (${c.delta >= 0 ? "+" : "−"}₹${Math.abs(c.delta).toFixed(2)}/box, ${c.deltaValue >= 0 ? "+" : "−"}${lakh(Math.abs(c.deltaValue))})`),
        movedByCap: r.moved,
        doubtsThatStillMatter: r.notes,
      };
    }
    if (fname === "get_cell_source") {
      const c = grid.cells[cellKey(String(args.vendorId), String(args.lineId))];
      if (!c) return { error: "No such vendor or line." };
      return { asWritten: c.norm.asWritten, perBox: c.perBox, calc: c.norm.calc, source: c.norm.source ? `${where(c.norm.source)}: "${c.norm.source.snippet}"` : null, check: c.norm.verification?.note, flags: c.norm.flags, lastYear: c.lastYear?.note ?? null, canWin: c.canWin, whyNot: c.whyNot };
    }
    if (fname === "show_view") { view = args.view === "chart" ? "chart" : "table"; return { ok: true }; }
    return { error: "Unknown tool." };
  };

  const system = `You are Parakh's analyst for ${ev.buyer} (category buyer) and ${ev.vp} (${ev.vpRole}) on sourcing event ${ev.id}, ${ev.title}.
Rules you never break:
- Never do arithmetic. Every number you state must come from a tool result, copied as given.
- For any what-if, call run_scenario with rules that match the question; the table updates to it. For several what-ifs, call it once per scenario.
- The AI never decides the award: recommend, and say the buyer decides.
- Answer in 2 to 4 plain sentences: the result, the cost against as quoted, who was excluded and why, and any doubt that still matters. Lines changing hands are shown to the user in the table; mention only the notable ones.
- The buyer's Scenario list already holds these strategies; when a question matches one, use exactly its rules: ${LIBRARY.map((x) => `"${x.title}" = ${JSON.stringify(x.rules)}`).join("; ")}. Otherwise combine the same building blocks (eligibility, exclusions, vendor limit, share cap, doubt pricing, discounts, freight).
- Quality is scored out of 100 against the buyer's marking scheme (pass mark ${scheme.passMark}); both mandatory items must pass.
- Vendor ids: ${grid.vendors.map((v) => `${v.id} = ${v.name}`).join(", ")}.
- If a question cannot be answered with the tools, say what is missing; never guess.`;

  const contents: Content[] = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.role === "user" && m.asker ? `${m.asker} asks: ${m.text}` : m.text }],
  }));

  try {
    let answer = "";
    let model: string = MODELS.reader;
    for (let step = 0; step < 6; step++) {
      budget();
      const { value: res, model: used } = await withModels("chat", MODELS.reader, (m) =>
        gemini().models.generateContent({ model: m, contents, config: { systemInstruction: system, tools: [{ functionDeclarations: TOOLS }], maxOutputTokens: 4000 } }),
      );
      model = res.modelVersion ?? used;
      const calls = res.functionCalls ?? [];
      const turn = res.candidates?.[0]?.content;
      if (!calls.length) { answer = res.text ?? ""; break; }
      if (turn) contents.push(turn);
      contents.push({ role: "user", parts: calls.map((c) => ({ functionResponse: { name: c.name!, id: c.id, response: { result: tool(c.name!, (c.args ?? {}) as Record<string, unknown>) } } })) });
    }
    return Response.json({ answer: answer || "I could not finish that answer. Try asking it another way.", scenarios, view, model });
  } catch (e) {
    const calm = e instanceof QuotaError || e instanceof RateLimitedError || e instanceof MissingKeyError;
    if (!calm) console.error("[chat]", e);
    return Response.json({ error: calm ? (e as Error).message : "Something went wrong while answering. Nothing was changed; try again in a minute." }, { status: calm ? 429 : 500 });
  }
}
