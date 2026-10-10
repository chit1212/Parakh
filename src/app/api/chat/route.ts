// L25 analyst chat. Two model calls at most, inside a hard deadline:
//   1. the model reads the question and picks the rules (structured JSON, no arithmetic);
//   2. code runs the solver; the model writes the answer from code's numbers, streamed.
// If step 2 cannot finish in time, code writes the answer from the same numbers.
// The model never does arithmetic: every number it states comes from the solver's result.
import { ApiError } from "@google/genai";
import { z } from "zod";
import { gemini, MissingKeyError } from "@/lib/ai";
import { buildGrid, cellKey, type Grid } from "@/lib/compare";
import { CHAT } from "@/lib/config";
import { applyDecisions, parseDecisions, type Decision } from "@/lib/decisions";
import { findDoubts, type DoubtReport } from "@/lib/doubts";
import { loadEventState } from "@/lib/event";
import { crore, lakh, rupees, where } from "@/lib/format";
import { callBudget, RateLimitedError, visitorOf } from "@/lib/guard";
import { loadDemoInbox } from "@/lib/inbox";
import { qualityOf, type Quality } from "@/lib/quality";
import { DEFAULT_SCHEME, schemeProblems, type QualityScheme } from "@/lib/qualityScheme";
import { isUsedUp, markUsedUp, QuotaError } from "@/lib/reader/call";
import type { ReplyReading } from "@/lib/reader/pipeline";
import { loadHistory } from "@/lib/rfq";
import { loadSavedReadings } from "@/lib/saved";
import { describeRules, goodTitle, LIBRARY, runScenario, sameRules, type ScenarioResult, type ScenarioRules } from "@/lib/scenario";
import { BASELINES, baselineFor, type BaselineKey } from "@/lib/baseline";
import { shares, yoyDrivers } from "@/lib/facts";
import type { LastYearLine } from "@/lib/types";
import type { SourcingEvent } from "@/lib/types";

export const runtime = "nodejs";
// The most the Hobby plan allows with Fluid compute; the chat's own deadline (CHAT.deadlineMs) is far shorter.
export const maxDuration = 300;

interface Msg { role: "user" | "assistant"; text: string; asker?: string }

const Pick = z.object({
  intent: z.enum(["scenario", "yoy", "cell_source", "table_fact", "cannot"]).describe("scenario = any what-if, award or premium/cost-of question solved by the rules below; yoy = what drives the change against last year's prices (biggest increases or contributors), under the rules below; cell_source = where one vendor's price for one line came from; table_fact = a question the as-quoted table answers (who is cheapest on a line, totals, quality, doubts, last year's prices); cannot = needs something the table does not have."),
  baseline: z.enum(["as_quoted", "quality_cleared", "unstated"]).describe("What the user compares against: as_quoted = cheapest per line among all vendors; quality_cleared = cheapest per line among quality-cleared vendors; unstated = the question names no baseline."),
  n: z.number().nullable().describe("yoy only: how many lines the user asks for (e.g. 'five biggest' = 5)."),
  title: z.string().describe("Scenario or yoy: a short label for the rules (not the question), e.g. 'Without <vendor>, cheapest per line' or 'Quality-cleared, max 37% per vendor'."),
  eligible: z.enum(["all", "quality_cleared"]),
  exclude: z.array(z.object({ vendorId: z.string(), reason: z.string() })).describe("Vendors the user wants left out, with the user's reason."),
  assumeDiscounts: z.boolean().describe("Treat conditional discounts as applying."),
  freight: z.enum(["as_read", "last_year"]).describe("Where freight is unknown: leave it out, or add last year's freight."),
  acceptHeld: z.boolean().describe("Let substitute specs and prices far below should-cost win as quoted."),
  worstCase: z.boolean().describe("Price every open doubt against the buyer."),
  cap: z.number().nullable().describe("Maximum share of award value for any one vendor, 0 to 1."),
  maxVendors: z.number().nullable().describe("Award to at most this many vendors."),
  overrides: z.array(z.object({ lineId: z.string(), vendorId: z.string() })).describe("Lines the user fixes to a vendor."),
  vendorId: z.string().nullable().describe("cell_source only."),
  lineId: z.string().nullable().describe("cell_source or table_fact about one line."),
  view: z.enum(["table", "chart", "export"]).describe("chart only if the user asks for a chart or picture; export only if the user asks to download, export or send a file (Excel)."),
  missing: z.string().nullable().describe("cannot only: what the table does not have."),
});
type Pick = z.infer<typeof Pick>;
const PICK_SCHEMA = (() => { const js = z.toJSONSchema(Pick) as Record<string, unknown>; delete js.$schema; return js; })();

/** One model call that gives up in time: busy or slow models are skipped at once, never waited on. */
async function fast<T>(deadline: number, budget: () => void, fn: (model: string, signal: AbortSignal) => Promise<T>): Promise<{ value: T; model: string }> {
  let busy = false;
  for (let pass = 0; pass < 2; pass++) {
    for (const model of CHAT.models) {
      const left = deadline - Date.now();
      if (left < 2500) throw new QuotaError(false);
      if (isUsedUp(model)) continue;
      budget();
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), Math.min(CHAT.perCallMs, left - 1000));
      try {
        return { value: await fn(model, ctl.signal), model };
      } catch (e) {
        if (e instanceof RateLimitedError || e instanceof MissingKeyError) throw e;
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 429 && /per ?day|PerDay|daily/i.test(e instanceof Error ? e.message : "")) markUsedUp(model);
        else busy = true;
        console.warn(`[chat] ${model}: ${ctl.signal.aborted ? "timed out" : `${status || "error"} ${(e as Error).message.slice(0, 100)}`}`);
      } finally {
        clearTimeout(t);
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new QuotaError(!busy);
}

/** The table the buyer is looking at, rebuilt in code from their readings (uploads and empty events included). */
async function tableFor(readings: ReplyReading[] | null, scheme: QualityScheme, decisions: Decision[]) {
  const state = await loadEventState();
  const history = await loadHistory();
  if (!readings && scheme === DEFAULT_SCHEME && !decisions.length) return { ...state, lastYear: history.lines };
  const ev = state.ev;
  const rs = readings ?? Object.values(await loadSavedReadings(await loadDemoInbox()));
  // The buyer's recorded decisions apply, as on their screen (an accepted price may win).
  const grid = applyDecisions(ev, readings ? buildGrid(ev, rs, history, {}, history.lines) : state.grid, decisions);
  const quality = ev.vendors.map((v) => qualityOf(ev, v.id, rs, scheme));
  const report = findDoubts(ev, grid, quality.filter((q) => q.cleared).map((q) => q.vendorId));
  return { ev, grid, quality, report, lastYear: history.lines };
}

function scenarioFacts(grid: Grid, r: ScenarioResult, title: string, base: { title: string; r: ScenarioResult }) {
  const name = (v: string | null) => (v ? grid.vendors.find((x) => x.id === v)?.short ?? v : "nobody");
  const d = r.award.total - base.r.award.total;
  return {
    scenario: title,
    "new total": `${crore(r.award.total)} (exactly ${rupees(r.award.total)})`,
    "compared with (baseline)": `${base.title}: ${crore(base.r.award.total)} (exactly ${rupees(base.r.award.total)})`,
    "change against the baseline": `${d >= 0 ? "+" : "−"}${lakh(Math.abs(d))} (exactly ${d >= 0 ? "+" : "−"}${rupees(Math.abs(d))}, ${d >= 0 ? "+" : "−"}${Math.abs((d / (base.r.award.total || 1)) * 100).toFixed(1)}%)`,
    "solver status": r.status === "proven_optimal" ? "proven cheapest under these rules" : r.status === "feasible" ? "meets the rules but is not proven cheapest; never call it minimum cost" : "the rules cannot all be met",
    "share of award value by vendor": shares(grid, r.award).map((s) => `${s.name} ${(s.pct * 100).toFixed(1)}%, ${s.lines} lines, ${lakh(s.value)}`),
    "left out, and why": r.excluded.map((e) => `${e.name}: ${e.why}`),
    "rules applied": r.rules,
    "number of lines changing hands": r.changed.length,
    "lines in the event": grid.lines.length,
    // More than 10: code picks the five that move the most rupees, so the model never ranks numbers.
    [r.changed.length > 10 ? "the five lines changing hands that move the most rupees (ranked by code)" : "lines changing hands"]: [...r.changed].sort((a, b) => (r.changed.length > 10 ? Math.abs(b.deltaValue) - Math.abs(a.deltaValue) : 0)).slice(0, r.changed.length > 10 ? 5 : undefined).map((c) => `${c.lineId} ${name(c.from)} → ${name(c.to)} (${c.delta >= 0 ? "+" : "−"}₹${Math.abs(c.delta).toFixed(2)}/box, ${c.deltaValue >= 0 ? "+" : "−"}${lakh(Math.abs(c.deltaValue))})`),
    "lines left unawarded": Object.entries(r.award.per).filter(([, w]) => !w).map(([l]) => l),
    notes: r.notes,
  };
}

/** Year on year, from the same function as the chart and the "vs last year" figure. */
function yoyFacts(grid: Grid, r: ScenarioResult, lastYear: LastYearLine[], title: string, n: number, ev: SourcingEvent) {
  const y = yoyDrivers(ev, r.award, lastYear, n);
  const name = (v: string) => grid.vendors.find((x) => x.id === v)?.short ?? v;
  const sum = y.top.reduce((a, d) => a + d.amount, 0);
  return {
    yoy: `${title}, against last year's prices (SE-2025-037)`,
    "lines with last year's price": y.comparableLines,
    "net change against last year": `${y.net >= 0 ? "+" : "−"}${lakh(Math.abs(y.net))} on those lines (${crore(y.lastYear)} last year → ${crore(y.thisYear)})`,
    [`the ${y.top.length} biggest (ranked by code), together`]: `${sum >= 0 ? "+" : "−"}${lakh(Math.abs(sum))}`,
    "top lines": y.top.map((d) => `${d.lineId} ${d.name}: ${d.amount >= 0 ? "+" : "−"}${lakh(Math.abs(d.amount))} (${name(d.vendorId)}, ₹${d.lyPrice.toFixed(2)} → ₹${d.price.toFixed(2)} per box, ${d.qty.toLocaleString("en-IN")} boxes)`),
  };
}

function tableFacts(ev: SourcingEvent, grid: Grid, quality: Quality[], report: DoubtReport, lineId: string | null, lastYear: LastYearLine[] = []) {
  const a = grid.asQuoted;
  const ly = yoyDrivers(ev, a, lastYear, 3);
  const name = (v: string) => grid.vendors.find((x) => x.id === v)?.short ?? v;
  const lines = ev.lines.filter((l) => !lineId || l.id === lineId);
  return {
    basis: "INR per box, delivered Chakan, GST extra. Conditional discounts not applied; unknown freight not added.",
    totalAsQuoted: crore(a.total),
    vendors: grid.vendors.map((v) => {
      const q = quality.find((x) => x.vendorId === v.id);
      return { vendor: v.short, quality: q?.returned ? `${q.score}/100, ${q.cleared ? "cleared" : "not cleared"} (${q.why})` : "questionnaire not returned", linesWon: a.byVendor[v.id].lines, value: lakh(a.byVendor[v.id].value) };
    }),
    lines: lines.map((l) => ({
      line: `${l.id} ${l.name}`,
      lowest: a.per[l.id] ? `${name(a.per[l.id]!.vendorId)} ₹${a.per[l.id]!.perBox.toFixed(2)}` : "none",
      ...(lineId ? { all: grid.vendors.map((v) => { const c = grid.cells[cellKey(v.id, l.id)]; return `${v.short}: ${c.perBox != null ? `₹${c.perBox.toFixed(2)}${c.canWin ? "" : ` (cannot win yet: ${c.whyNot})`}` : "not quoted"}`; }) } : {}),
    })),
    openDoubts: report.raised.map((d) => `${d.title} (${lakh(d.stake)} at stake)`),
    lastYear: `${ly.comparableLines} lines have last year's price (SE-2025-037); as quoted, they cost ${ly.net >= 0 ? "+" : "−"}${lakh(Math.abs(ly.net))} against last year`,
    ...(lineId ? { lastYearPrice: lastYear.find((x) => x.lineId === lineId) ? `₹${lastYear.find((x) => x.lineId === lineId)!.price.toFixed(2)} per box last year` : "new line, no price last year" } : {}),
  };
}

/** The answer in code's own words, from the same facts, for when the model cannot write it in time. */
function codeAnswer(f: Record<string, unknown>): string {
  if ("scenario" in f) {
    const x = f as ReturnType<typeof scenarioFacts>;
    const moves = (x["lines changing hands"] ?? x["the five lines changing hands that move the most rupees (ranked by code)"]) as string[];
    const n = x["number of lines changing hands"];
    return `${x.scenario}: ${x["new total"]}, ${x["change against the baseline"]} against ${x["compared with (baseline)"]}. Shares: ${x["share of award value by vendor"].join("; ")}.`
      + (x["left out, and why"].length ? ` Left out: ${x["left out, and why"].join("; ")}.` : "")
      + (n ? ` ${n} line${n === 1 ? "" : "s"} change hands${n > moves.length ? `; the five that move the most: ` : ": "}${moves.join("; ")}.` : " No line changes hands.")
      + (x["lines left unawarded"].length ? ` Not awarded: ${x["lines left unawarded"].join(", ")}.` : "")
      + " Solved in code; the buyer decides.";
  }
  if ("yoy" in f) {
    const y = f as { yoy: string; "net change against last year": string; "top lines": string[] };
    return `${y.yoy}: ${y["net change against last year"]}. The biggest: ${y["top lines"].join("; ")}.`;
  }
  if ("missing" in f) return `I cannot answer that from this table: ${f.missing}`;
  return `From the table: ${JSON.stringify(f).slice(0, 600)}`;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { messages?: Msg[]; scheme?: QualityScheme; readings?: ReplyReading[]; decisions?: unknown; prior?: (ScenarioRules & { title: string })[]; active?: ScenarioRules };
  const messages = body.messages;
  if (!messages?.length) return Response.json({ error: "Ask a question." }, { status: 400 });
  const deadline = Date.now() + CHAT.deadlineMs;
  const budget = callBudget(visitorOf(req));

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(ctrl) {
      const send = (o: unknown) => ctrl.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        const { ev } = await loadEventState();
        const scheme = body.scheme && Array.isArray(body.scheme.rules) && !schemeProblems(body.scheme, ev.questions.map((x) => x.id)).length ? body.scheme : DEFAULT_SCHEME;
        const own = Array.isArray(body.readings) && body.readings.length <= 40 && body.readings.every((r) => r && typeof r.replyId === "string" && Array.isArray(r.prices)) ? body.readings : null;
        const { grid, quality, report, lastYear } = await tableFor(own, scheme, parseDecisions(body.decisions));
        const active: ScenarioRules = body.active && (body.active.eligible === "all" || body.active.eligible === "quality_cleared") ? body.active : LIBRARY.find((x) => x.key === "S1")!.rules;
        const ids = new Set(grid.vendors.map((v) => v.id));
        const lineIds = new Set(ev.lines.map((l) => l.id));

        // 1. The model picks the rules. Vendor documents never reach this step; only the buyer's words do.
        send({ type: "status", text: "Choosing the rules…" });
        const q = messages[messages.length - 1];
        const history = messages.slice(-7, -1).map((m) => `${m.role === "user" ? m.asker ?? "User" : "Parakh"}: ${m.text.slice(0, 400)}`).join("\n");
        const system = `You turn a procurement question into rules for a code solver. You never do arithmetic and never answer the question yourself.
Event ${ev.id}, ${ev.title}: ${ev.lines.length} lines, prices per box in INR, delivered Chakan, GST extra.
Vendors (id: name, quality): ${grid.vendors.map((v) => { const x = quality.find((y) => y.vendorId === v.id); return `${v.id}: ${v.name} (${x?.returned ? `${x.score}/100, ${x.cleared ? "cleared" : "not cleared"}` : "no questionnaire"})`; }).join("; ")}.
Lines: ${ev.lines.map((l) => `${l.id} ${l.name}`).join("; ")}.
Strategies already in the buyer's list; when the question matches one, use exactly its rules: ${LIBRARY.map((x) => `"${x.title}" = ${JSON.stringify(x.rules)}`).join("; ")}.
Scenarios asked earlier in this conversation (for "same split, but…"): ${(body.prior ?? []).slice(-3).map((p) => JSON.stringify(p)).join("; ") || "none"}.
For yoy, set the rules for the award being compared with last year (e.g. "among quality-cleared vendors" = eligible "quality_cleared"); if the question does not say, use the scenario on the buyer's screen: ${JSON.stringify(active)}.
Defaults when the question does not say: eligible "all", no exclusions, assumeDiscounts false, freight "as_read", acceptHeld false, worstCase false, cap null, maxVendors null, overrides [], view "table". "Drop" or "without" a vendor means exclude it, with the user's reason or "left out by the buyer".`;
        const pick = await fast(deadline, budget, (model, signal) =>
          gemini().models.generateContent({
            model,
            contents: [{ role: "user", parts: [{ text: `${history ? `Conversation so far:\n${history}\n\n` : ""}Question from ${q.asker ?? "the buyer"}: ${q.text.slice(0, 800)}` }] }],
            config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: PICK_SCHEMA, maxOutputTokens: 1500, temperature: 0, abortSignal: signal },
          }).then((r) => Pick.parse(JSON.parse(r.text ?? "{}"))),
        );
        const p: Pick = pick.value;

        // 2. Code answers: the solver, a cell's source, or the table as quoted.
        let facts: Record<string, unknown>;
        if (p.intent === "scenario") {
          const rules: ScenarioRules = {
            eligible: p.eligible, assumeDiscounts: p.assumeDiscounts, freight: p.freight, acceptHeld: p.acceptHeld, worstCase: p.worstCase,
            cap: p.cap && p.cap > 0 && p.cap < 1 ? p.cap : null, maxVendors: p.maxVendors && p.maxVendors >= 1 ? Math.floor(p.maxVendors) : null,
            exclude: p.exclude.filter((x) => ids.has(x.vendorId)),
            overrides: p.overrides.filter((o) => ids.has(o.vendorId) && lineIds.has(o.lineId)),
          };
          const lib = LIBRARY.find((x) => sameRules(x.rules, rules));
          const title = lib?.title ?? (goodTitle(p.title) ? p.title.trim() : describeRules(rules, (v) => grid.vendors.find((x) => x.id === v)?.short ?? v));
          const r = runScenario(ev, grid, quality, rules);
          // Every comparison states its baseline: the one asked for, else the screen's eligibility (never all vendors by default).
          const baseline: BaselineKey = baselineFor(p.baseline, rules, active);
          const b = runScenario(ev, grid, quality, BASELINES[baseline].rules);
          send({ type: "scenario", scenario: { title, ...rules }, view: p.view, baseline });
          if (p.view === "export") send({ type: "export" });
          facts = scenarioFacts(grid, r, title, { title: BASELINES[baseline].title, r: b });
        } else if (p.intent === "yoy") {
          const rules: ScenarioRules = { eligible: p.eligible, exclude: p.exclude.filter((x) => ids.has(x.vendorId)), assumeDiscounts: p.assumeDiscounts, freight: p.freight, acceptHeld: p.acceptHeld, worstCase: p.worstCase, cap: p.cap && p.cap > 0 && p.cap < 1 ? p.cap : null, maxVendors: p.maxVendors && p.maxVendors >= 1 ? Math.floor(p.maxVendors) : null, overrides: [] };
          const n = Math.min(10, Math.max(1, Math.floor(p.n ?? 5)));
          const lib = LIBRARY.find((x) => sameRules(x.rules, rules));
          const title = lib?.title ?? (goodTitle(p.title) ? p.title.trim() : describeRules(rules, (v) => grid.vendors.find((x) => x.id === v)?.short ?? v));
          send({ type: "yoy", scenario: { title, ...rules }, n });
          facts = yoyFacts(grid, runScenario(ev, grid, quality, rules), lastYear, title, n, ev);
        } else if (p.view === "export" && p.intent !== "cannot") {
          // "Export this": the buyer's current view, as an Excel file, built in code on their screen.
          send({ type: "export" });
          facts = { exported: "The table as shown on the buyer's screen was downloaded as an Excel file, with every number's source.", ...tableFacts(ev, grid, quality, report, null, lastYear) };
        } else if (p.intent === "cell_source" && p.vendorId && p.lineId && ids.has(p.vendorId) && lineIds.has(p.lineId)) {
          const c = grid.cells[cellKey(p.vendorId, p.lineId)];
          facts = { cell: `${grid.vendors.find((v) => v.id === p.vendorId)!.short} ${p.lineId}`, asWritten: c.norm.asWritten, perBox: c.perBox != null ? `₹${c.perBox.toFixed(2)}` : "not on the basis", calculation: c.norm.calc, source: c.norm.source ? `${where(c.norm.source)}: "${c.norm.source.snippet}"` : null, check: c.norm.verification?.note ?? null, otherReadings: c.norm.alternatives.map((a) => `${a.value} (₹${a.perBox.toFixed(2)}/box): ${a.reason}`), lastYear: c.lastYear?.note ?? null, canWin: c.canWin ? "yes" : `no: ${c.whyNot}` };
        } else if (p.intent === "cannot") {
          facts = { missing: p.missing ?? "the table does not hold that." };
        } else {
          facts = tableFacts(ev, grid, quality, report, p.lineId && lineIds.has(p.lineId) ? p.lineId : null, lastYear);
        }

        // 3. The model writes the answer from code's facts, streamed. Code's own words if time runs out.
        send({ type: "status", text: "Writing the answer…" });
        let wrote = "";
        let model = pick.model;
        try {
          const res = await fast(deadline, budget, async (m, signal) => {
            const s = await gemini().models.generateContentStream({
              model: m,
              contents: [{ role: "user", parts: [{ text: `Question from ${q.asker ?? "the buyer"}: ${q.text.slice(0, 800)}\n\nFacts from code (copy numbers exactly as given):\n${JSON.stringify(facts)}` }] }],
              config: {
                systemInstruction: `You are Parakh, a procurement analyst for ${ev.buyer} (buyer) and ${ev.vp} (${ev.vpRole}). Answer the question from the facts only, in 2 to 5 plain sentences.
- Never calculate: every number you write must appear in the facts, copied exactly.
- For a scenario: name the baseline first ("Compared with …"), then the exact new total and the change against that baseline, each vendor's share, who is left out and why (briefly), and the lines changing hands exactly as listed: all of them if the facts list them all, otherwise say how many change hands out of the lines in the event (e.g. "25 of 30") and name the five the facts give. Use "minimum cost" or "cheapest" only if the solver status says proven cheapest. Mention a note only if it matters.
- For year on year: the net change, then the lines exactly as listed with their amounts.
- If the facts say a file was exported, say so in one sentence first.
- Write in plain words; never repeat the facts' field names. Do not address people by name. No headings, no bullet points.
- For a scenario only, you may end with one short clause that the buyer decides the award. For other questions, do not.`,
                maxOutputTokens: 900, temperature: 0.2, abortSignal: signal,
              },
            });
            for await (const chunk of s) {
              const t = chunk.text ?? "";
              if (t) { wrote += t; send({ type: "delta", text: t }); }
            }
            return true;
          });
          model = res.model;
        } catch (e) {
          if (e instanceof RateLimitedError) throw e;
          if (!wrote) send({ type: "delta", text: codeAnswer(facts) });
          model = `${pick.model}; answer written by code`;
        }
        send({ type: "done", model });
      } catch (e) {
        const calm = e instanceof QuotaError || e instanceof RateLimitedError || e instanceof MissingKeyError;
        if (!calm) console.error("[chat]", e);
        send({ type: "error", message: calm ? (e as Error).message : "Something went wrong while answering. Nothing was changed; try again in a minute." });
      } finally {
        ctrl.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
