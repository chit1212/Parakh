// Reading one reply, end to end: open (code) → sort (AI) → read prices and sweep terms (AI)
// → check every source (code) → coverage (code).
import type { z } from "zod";
import { MissingKeyError, type Usage } from "../ai";
import { RateLimitedError } from "../guard";
import { MODELS } from "../config";
import { workbookToText } from "../files/xlsx";
import { loadHistory } from "../rfq";
import type { Reply, ReplyFile, SourcingEvent, Verification } from "../types";
import { callStructured, QuotaError } from "./call";
import { buyerRecordBlock, fileBlocks } from "./content";
import { classifySystem, extractionSystem, termsSystem } from "./prompts";
import {
  Classification, Extraction, type NotQuoted, type PriceItem, type QualityDoc, type QuestionnaireAnswer,
  type RateRule, type TermItem, TermsSweep,
} from "./schemas";
import { contains, verifySource, type RecordFile } from "./verify";

export type ReplyStatus = "read" | "incomplete" | "unreadable" | "pending" | "ignored" | "error";

export type Checked<T> = T & { verification: Verification };

export interface NextStep {
  kind: "none" | "resend_request" | "wait" | "ignore" | "ask_missing_pages" | "check_reply";
  text: string;
}

export interface ReplyReading {
  replyId: string;
  vendorId: string | null;
  vendorName: string | null;
  status: ReplyStatus;
  headline: string;
  nextStep: NextStep;
  classification: Classification | null;
  prices: Checked<z.infer<typeof PriceItem>>[];
  rateRules: Checked<z.infer<typeof RateRule>>[];
  notQuoted: z.infer<typeof NotQuoted>[];
  terms: Checked<z.infer<typeof TermItem>>[];
  questionnaire: Checked<z.infer<typeof QuestionnaireAnswer>>[];
  qualityDocs: Checked<z.infer<typeof QualityDoc>>[];
  revision: TermsSweep["revision"] | null;
  readingNotes: string[];
  coverage: { quoted: string[]; missing: string[]; total: number };
  /** Values that did not pass the source check. They never enter the comparison. */
  unsourced: number;
  usage: Usage[];
  cached: boolean;
  ms: number;
  /** When the model read this reply (latest model answer), ISO time. Null if no model was called. */
  readAt: string | null;
  /** The models that actually answered, in order. */
  models: string[];
  /** When the reply arrived (from its email, or the upload time), so the newest offer wins. */
  receivedAt?: string | null;
  /** Set when served from data/readings (a saved run of this pipeline), not read just now. */
  saved?: boolean;
  /** True when the error is the free quota (or the demo's own limit), not a problem with the file. */
  quota?: boolean;
  error?: string;
}

export type Stage = "opening" | "sorting" | "reading prices" | "sweeping terms" | "waiting for the free quota" | "checking sources" | "done";
export type OnProgress = (stage: Stage, detail?: string) => void;

const PAGE_OF = /page\s+(\d+)\s+of\s+(\d+)/gi;

/** Code's own check for missing pages, independent of the model. */
function missingPages(files: ReplyFile[]): string | null {
  for (const f of files) {
    if (f.kind !== "pdf" || !f.pdfPages) continue;
    let declared = 0;
    for (const p of f.pdfPages) for (const m of p.matchAll(PAGE_OF)) declared = Math.max(declared, Number(m[2]));
    if (declared > f.pdfPages.length)
      return `${f.name} says "of ${declared}" pages but contains ${f.pdfPages.length}.`;
    if (f.pdfPages.some((p) => /continued on page/i.test(p)) && f.pdfPages.length === 1)
      return `${f.name} says it continues on another page, which is not attached.`;
  }
  return null;
}

function empty(reply: Reply, ev: SourcingEvent): ReplyReading {
  const v = ev.vendors.find((x) => x.id === reply.vendorId) ?? null;
  return {
    replyId: reply.id, vendorId: v?.id ?? null, vendorName: v?.name ?? null,
    status: "read", headline: "", nextStep: { kind: "none", text: "" },
    classification: null, prices: [], rateRules: [], notQuoted: [], terms: [], questionnaire: [], qualityDocs: [],
    revision: null, readingNotes: [], coverage: { quoted: [], missing: ev.lines.map((l) => l.id), total: ev.lines.length },
    unsourced: 0, usage: [], cached: true, ms: 0, readAt: null, models: [], receivedAt: reply.receivedAt,
  };
}

function matchVendor(ev: SourcingEvent, name: string | null) {
  if (!name) return null;
  const n = name.toLowerCase();
  return ev.vendors.find((v) => n.includes(v.name.toLowerCase().split(" ").slice(0, 2).join(" "))) ?? null;
}

export async function readReply(
  reply: Reply,
  ev: SourcingEvent,
  opts: { onProgress?: OnProgress; fresh?: boolean; beforeCall?: () => void } = {},
): Promise<ReplyReading> {
  const t0 = Date.now();
  const say = opts.onProgress ?? (() => {});
  const out = empty(reply, ev);
  const all = [...(reply.cover ? [reply.cover] : []), ...reply.files];
  const track = (r: { usage: Usage | null; cached: boolean; model: string; at: string }) => {
    if (r.usage) out.usage.push(r.usage);
    if (!r.cached) out.cached = false;
    if (!out.models.includes(r.model)) out.models.push(r.model);
    if (!out.readAt || r.at > out.readAt) out.readAt = r.at;
  };
  const onWait = (s: number) => say("waiting for the free quota", `retrying in ${s}s`);

  try {
    // 1. Open (code). A reply whose only content cannot be opened is unreadable; no model call.
    say("opening");
    const broken = all.filter((f) => f.parseError);
    const readable = all.filter((f) => !f.parseError);
    if (readable.length === 0) {
      out.status = "unreadable";
      out.headline = `Could not open ${broken.map((f) => f.name).join(", ")}: ${broken[0]?.parseError ?? "unknown error"}`;
      out.nextStep = reply.from
        ? { kind: "resend_request", text: `Ask ${reply.from} to send the file again.` }
        : { kind: "resend_request", text: "The file arrived without a sender. Ask the vendors who have not replied whether it is theirs, and request a fresh copy." };
      return out;
    }

    // 2. Sort (cheap model): what is this, what is each file for, does anything look missing?
    say("sorting");
    const cls = await callStructured({
      step: "classify",
      model: MODELS.classifier,
      system: classifySystem(ev),
      content: [
        ...fileBlocks(all, { textExcerpt: 2500 }),
        { text: `Sort this reply. Received: ${reply.receivedAt ?? "unknown"}. From: ${reply.from ?? "unknown (no email)"}.` },
      ],
      schema: Classification,
      effort: "low",
      maxTokens: 4000,
      fresh: opts.fresh,
      beforeCall: opts.beforeCall,
      onWait,
    });
    track(cls);
    const c = cls.data;
    out.classification = c;
    if (!out.vendorId) {
      const v = matchVendor(ev, c.vendor_name);
      out.vendorId = v?.id ?? null;
      out.vendorName = v?.name ?? c.vendor_name;
    }
    if (broken.length) out.readingNotes.push(`Could not open ${broken.map((f) => f.name).join(", ")}.`);

    if (c.category === "spam" || c.category === "unrelated") {
      out.status = "ignored";
      out.headline = c.reason;
      out.nextStep = { kind: "ignore", text: "Nothing to do. Kept out of the comparison." };
      return out;
    }
    if (c.category === "not_a_quote_yet") {
      out.status = "pending";
      out.headline = c.reason;
      out.nextStep = { kind: "wait", text: c.promised_followup ? `Waiting: ${c.promised_followup}` : "Waiting for prices." };
      return out;
    }

    // 3. Read prices and sweep terms (strong model), in parallel.
    const roles = new Map(c.files.map((f) => [f.name.toLowerCase(), f.role]));
    const quoteFiles = readable.filter((f) => f === reply.cover || roles.get(f.name.toLowerCase()) === "quote" || !roles.has(f.name.toLowerCase()));
    const vendorName = out.vendorName ?? c.vendor_name ?? "";
    const history = await loadHistory();
    const key = vendorName.toLowerCase().split(" ").slice(0, 2).join(" ");
    const recordSheets = key ? history.sheets.filter((s) => s.name.toLowerCase().includes(key)) : [];
    const records: RecordFile[] = recordSheets.length ? [{ file: history.file, sheets: recordSheets }] : [];
    const recordBlocks = recordSheets.map((s) =>
      buyerRecordBlock(history.file, s.name, workbookToText(history.file, [s]).split("\n").slice(2).join("\n")),
    );

    say("reading prices");
    const extractP = callStructured({
      step: "extract",
      model: MODELS.reader,
      system: extractionSystem(ev),
      content: [
        ...fileBlocks(quoteFiles),
        ...recordBlocks,
        { text: `Read every price in this reply from ${vendorName || "an unknown vendor"}. Report every RFQ line it does not price in not_quoted.` },
      ],
      schema: Extraction,
      effort: "medium",
      maxTokens: 32000,
      fresh: opts.fresh,
      beforeCall: opts.beforeCall,
      onWait,
    }).then((r) => { say("sweeping terms"); return r; });
    const termsP = callStructured({
      step: "terms",
      model: MODELS.reader,
      system: termsSystem(ev),
      content: [
        ...fileBlocks(readable),
        { text: `Find every commercial term, questionnaire answer and quality document in this reply from ${vendorName || "an unknown vendor"}.` },
      ],
      schema: TermsSweep,
      effort: "medium",
      maxTokens: 24000,
      fresh: opts.fresh,
      beforeCall: opts.beforeCall,
      onWait,
    });
    const [ex, tm] = await Promise.all([extractP, termsP]);
    track(ex);
    track(tm);

    // 4. Check every source (code, independent of the model).
    say("checking sources");
    const lineIds = new Set(ev.lines.map((l) => l.id));
    out.prices = ex.data.prices.map((p) => ({
      ...p,
      line_id: p.line_id && lineIds.has(p.line_id) ? p.line_id : null,
      verification: verifySource(p.source, readable, records, { valueText: p.raw_value_text, value: p.raw_value }, p.line_id ?? undefined),
    }));
    out.rateRules = ex.data.rate_rules.map((r) => ({
      ...r,
      verification: verifySource(r.source, readable, records, { valueText: r.value_text, value: r.value }),
    }));
    out.notQuoted = ex.data.not_quoted.filter((n) => lineIds.has(n.line_id));
    out.readingNotes.push(...ex.data.reading_notes);
    out.terms = tm.data.terms.map((t) => ({
      ...t,
      verification: verifySource(t.source, readable, records, t.value !== null ? { value: t.value } : {}),
    }));
    out.questionnaire = tm.data.questionnaire.map((q) => ({ ...q, verification: verifySource(q.source, readable, records) }));
    out.qualityDocs = tm.data.quality_documents.map((q) => ({ ...q, verification: verifySource(q.source, readable, records) }));
    out.revision = tm.data.revision;
    out.unsourced =
      out.prices.filter((p) => p.verification.status === "failed").length +
      out.rateRules.filter((r) => r.verification.status === "failed").length;

    // 5. Coverage (code): a line is covered by a checked price, or by a checked per-kg rate for its ply.
    const quoted = new Set<string>();
    for (const p of out.prices) if (p.line_id && p.verification.status !== "failed") quoted.add(p.line_id);
    const plyRates = new Set(
      out.rateRules.filter((r) => r.component === "board_per_kg" && r.verification.status !== "failed").map((r) => r.applies_to_ply),
    );
    for (const l of ev.lines) if (plyRates.has(l.plyN) || plyRates.has(null)) quoted.add(l.id);
    out.coverage = {
      quoted: ev.lines.filter((l) => quoted.has(l.id)).map((l) => l.id),
      missing: ev.lines.filter((l) => !quoted.has(l.id)).map((l) => l.id),
      total: ev.lines.length,
    };

    // 6. Status. Missing pages hold the reply out of the comparison until the buyer decides.
    // The sorter only sees an excerpt, so its doubt needs a source like everything else: the words
    // it quotes must be in a file (photos and scans, which code cannot search, are taken as given).
    // Page counts are code's call: where every PDF's "page x of n" marks match its real page count,
    // a sorter's doubt about pages is overruled.
    const pagesCounted = readable.some((f) => f.kind === "pdf" && f.pdfPages?.some((p) => /page\s+\d+\s+of\s+\d+/i.test(p)));
    const searchable = readable.filter((f) => f.text !== undefined || f.pdfPages?.some((p) => p.trim()));
    const ev0 = c.incomplete_evidence ?? "";
    const evidenceFound = readable.length > searchable.length ||
      searchable.some((f) => contains(f.text ?? f.pdfPages!.join("\n"), ev0));
    const sorterDoubt = c.looks_incomplete && evidenceFound && !(pagesCounted && /page/i.test(ev0 || "page"));
    const pagesMissing = missingPages(readable) ?? (sorterDoubt ? c.incomplete_evidence ?? "The reply looks incomplete." : null);
    if (c.looks_incomplete && !sorterDoubt) out.readingNotes.push(`The sorter thought pages might be missing (${c.incomplete_evidence ?? "no detail"}); code found no sign of it in the files.`);
    const n = out.coverage.quoted.length;
    if (pagesMissing) {
      out.status = "incomplete";
      out.headline = `${pagesMissing} Read ${n} of ${out.coverage.total} lines from what arrived.`;
      out.nextStep = { kind: "ask_missing_pages", text: "Ask the vendor for the missing page before treating this as a partial quote." };
    } else {
      out.status = "read";
      out.headline = `${n} of ${out.coverage.total} lines quoted.`;
      out.nextStep = out.unsourced
        ? { kind: "check_reply", text: `${out.unsourced} value(s) could not be found where the reader said; they are kept out of the comparison.` }
        : { kind: "none", text: "" };
    }
    return out;
  } catch (e) {
    out.status = "error";
    out.cached = false;
    // Quota, demo limit and missing key are not problems with the file: say so calmly.
    out.quota = e instanceof QuotaError || e instanceof RateLimitedError || e instanceof MissingKeyError;
    out.error = (e as Error).message;
    out.headline = out.quota ? (e as Error).message : `Reading stopped: ${(e as Error).message}`;
    out.nextStep = { kind: "check_reply", text: out.quota ? "Nothing is wrong with the file. Read it again later." : "Try reading it again." };
    return out;
  } finally {
    out.ms = Date.now() - t0;
    say("done");
  }
}
