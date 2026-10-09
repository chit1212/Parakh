// L24 test scorecard. Grades the reader's output against dataset/06_answer_key.
// TEST-ONLY: nothing that produces results may import this file (pinned in test/isolation.test.ts).
import fs from "node:fs/promises";
import { datasetPath } from "./rfq";
import type { ReplyReading } from "./reader/pipeline";
import type { SourcingEvent } from "./types";

interface KeyCell {
  as_written: string;
  source: string;
  normalised: number | null;
}

interface Key {
  cells: Record<string, KeyCell | null>;
  questionnaire: { results: Record<string, { returned: boolean }> };
  failure_cases: Record<string, string>;
}

export async function loadKey(): Promise<Key> {
  return JSON.parse(await fs.readFile(datasetPath("06_answer_key/answer_key.json"), "utf8"));
}

/** Which reply in the demo inbox the key's cells were written against. */
export const KEY_REPLY: Record<string, string> = {
  SB: "6_revised_quote", // the key reflects the revised offer R1
  VP: "2_vardhman_pdf",
  KP: "3_kaveri_word",
  AC: "4_anand_photo",
  RB: "5_rohit_email",
};

interface Expected {
  notQuoted: boolean;
  value: number | null;
  currency: "INR" | "USD" | null;
  unit: "per_box" | "per_100" | "per_kg" | null;
  basis: "delivered" | "ex_works" | null;
  lastYear: boolean;
  file: string;
  cell: string | null;
  page: number | null;
  row: string | null;
}

/** Parse the key's plain-English "as written" and "source" strings into fields. */
function expected(c: KeyCell): Expected {
  const aw = c.as_written;
  const file = c.source.split(",")[0].trim();
  const cell = c.source.match(/cell ([A-Z]+\d+)/)?.[1] ?? null;
  const page = Number(c.source.match(/page (\d+)/)?.[1]) || null;
  const row = c.source.match(/row (L?\d+)/)?.[1] ?? null;
  if (/^not quoted/i.test(aw))
    return { notQuoted: true, value: null, currency: null, unit: null, basis: null, lastYear: false, file, cell, page, row };
  const v = aw.match(/([\d,]+(?:\.\d+)?)/);
  return {
    notQuoted: false,
    value: v ? Number(v[1].replace(/,/g, "")) : null,
    currency: /^USD/.test(aw) ? "USD" : "INR",
    unit: /per 100/i.test(aw) ? "per_100" : /\/kg/i.test(aw) ? "per_kg" : "per_box",
    basis: /ex-works/i.test(aw) ? "ex_works" : /delivered/i.test(aw) ? "delivered" : null,
    lastYear: /last year/i.test(aw),
    file, cell, page, row,
  };
}

export interface FieldScore {
  field: string;
  right: number;
  total: number;
}

export interface CellResult {
  vendor: string;
  line: string;
  expected: string;
  got: string;
  ok: boolean;
  misses: string[];
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface Scorecard {
  fields: FieldScore[];
  byVendor: { vendor: string; right: number; total: number }[];
  cells: CellResult[];
  edges: Check[];
  failures: Check[];
  notYet: string[];
  /** Models that produced the graded readings. */
  models: string[];
}

const unitOf = (u: string) => (u === "per_piece" ? "per_box" : u);

export function grade(ev: SourcingEvent, key: Key, readings: ReplyReading[]): Scorecard {
  const byReply = new Map(readings.map((r) => [r.replyId, r]));
  const tally = new Map<string, FieldScore>();
  const vendorTally = new Map<string, { right: number; total: number }>();
  const mark = (field: string, vendor: string, ok: boolean) => {
    const t = tally.get(field) ?? { field, right: 0, total: 0 };
    t.total++;
    if (ok) t.right++;
    tally.set(field, t);
    const v = vendorTally.get(vendor) ?? { right: 0, total: 0 };
    v.total++;
    if (ok) v.right++;
    vendorTally.set(vendor, v);
  };
  const cells: CellResult[] = [];

  for (const [k, c] of Object.entries(key.cells)) {
    if (!c) continue;
    const [vid, lid] = k.split("|");
    const line = ev.lines.find((l) => l.id === lid)!;
    const r = byReply.get(KEY_REPLY[vid]);
    const e = expected(c);
    const misses: string[] = [];
    let got = "no reading";
    const check = (field: string, ok: boolean) => {
      mark(field, vid, ok);
      if (!ok) misses.push(field);
    };

    if (!r || r.status === "error") {
      check("line found", false);
    } else if (e.notQuoted) {
      const priced = r.prices.some((p) => p.line_id === lid && p.verification.status !== "failed");
      got = priced ? "priced" : "not quoted";
      check("line found", !priced && r.coverage.missing.includes(lid));
    } else if (e.unit === "per_kg") {
      // Rate-based vendor: the line is priced through a per-kg rate for its ply.
      const rule = r.rateRules.find((x) => x.component === "board_per_kg" && (x.applies_to_ply === line.plyN || x.applies_to_ply === null));
      got = rule ? `${rule.value_text}/kg${rule.from_earlier_record ? " (earlier record)" : ""}` : "no rate";
      check("line found", Boolean(rule));
      if (rule) {
        check("value", rule.value === e.value);
        check("currency", rule.currency === e.currency);
        check("last-year label", rule.from_earlier_record === e.lastYear);
        check("source checked", rule.verification.status === "verified");
      }
    } else {
      const ps = r.prices.filter((p) => p.line_id === lid);
      const p = ps.find((x) => x.verification.status !== "failed") ?? ps[0];
      got = p ? `${p.raw_value_text} ${p.unit} ${p.currency} ${p.price_basis}` : "not found";
      check("line found", Boolean(p));
      if (p) {
        check("value", Math.abs(p.raw_value - (e.value ?? NaN)) < 1e-9);
        check("unit", unitOf(p.unit) === e.unit);
        check("currency", p.currency === e.currency);
        check("price basis", p.price_basis === e.basis);
        let place = p.source.file.toLowerCase() === e.file.toLowerCase();
        if (e.cell) place &&= p.source.cell?.toUpperCase() === e.cell;
        if (e.page) place &&= p.source.page === e.page;
        if (e.row && e.file.endsWith(".jpg")) place &&= p.source.row === e.row;
        if (e.row && e.file.endsWith(".docx")) place &&= p.source.table === 1 && p.verification.status === "verified";
        check("source location", place);
        if (p.verification.status !== "photo") check("source checked", p.verification.status === "verified");
      }
    }
    cells.push({ vendor: vid, line: lid, expected: c.as_written, got, ok: misses.length === 0, misses });
  }

  // Planted edges the reader must notice (from dataset/README.md).
  const R = (vid: string) => byReply.get(KEY_REPLY[vid]);
  const term = (vid: string, kind: string, pred: (t: ReplyReading["terms"][number]) => boolean) =>
    R(vid)?.terms.find((t) => t.kind === kind && pred(t));
  const edges: Check[] = [];
  const edge = (name: string, ok: boolean, detail: string) => edges.push({ name, ok, detail });

  const sbFreight = term("SB", "freight", (t) => t.value === 0.35);
  edge("Shree Balaji: freight ₹0.35/box found on the T&C sheet", Boolean(sbFreight), sbFreight ? `${sbFreight.source.sheet}!${sbFreight.source.cell}` : "not found");
  const sbEx = R("SB")?.prices.filter((p) => p.price_basis === "ex_works").length ?? 0;
  edge("Shree Balaji: prices read as ex-works", sbEx >= 28, `${sbEx} of 30 ex-works`);
  edge("Shree Balaji: lines matched without line ids", (R("SB")?.coverage.quoted.length ?? 0) === 30, `${R("SB")?.coverage.quoted.length ?? 0} of 30 matched`);
  const rev = R("SB")?.revision;
  edge("Shree Balaji R1: recognised as a revision", Boolean(rev?.is_revision), rev?.supersedes ?? "not recognised");

  const vpDisc = term("VP", "discount", (t) => t.value === 2.5);
  edge("Vardhman: 2.5% discount found in the page-3 footnote", Boolean(vpDisc), vpDisc ? `page ${vpDisc.source.page}` : "not found");
  edge("Vardhman: discount condition (single PO over ₹25 lakh) captured", vpDisc?.condition_threshold_inr === 2_500_000, vpDisc?.condition ?? "no condition");
  const vpUsd = R("VP")?.prices.filter((p) => p.currency === "USD").length ?? 0;
  edge("Vardhman: prices read in USD, not converted", vpUsd === 30, `${vpUsd} of 30 in USD`);

  const kpFreight = term("KP", "freight", (t) => t.value === 0.4);
  const kpHandling = term("KP", "handling", (t) => t.value === 15);
  edge("Kaveri: freight ₹0.40/box found in the paragraph", Boolean(kpFreight), kpFreight?.summary ?? "not found");
  edge("Kaveri: 15% handling on freight found", Boolean(kpHandling), kpHandling?.summary ?? "not found");
  const kp100 = R("KP")?.prices.filter((p) => p.unit === "per_100").length ?? 0;
  edge("Kaveri: prices read per 100 pieces, not converted", kp100 === 30, `${kp100} of 30 per 100`);
  const kp09 = R("KP")?.prices.find((p) => p.line_id === "L09");
  edge("Kaveri: L09 read exactly as written (579.00)", kp09?.raw_value === 579, kp09?.raw_value_text ?? "not found");

  edge("Anand: 27 of 30 lines quoted", R("AC")?.coverage.quoted.length === 27, `${R("AC")?.coverage.quoted.length ?? 0} quoted; missing ${R("AC")?.coverage.missing.join(", ")}`);
  const ac14 = R("AC")?.prices.find((p) => p.line_id === "L14");
  edge("Anand: L14 flagged as 3-ply where 5-ply was asked", Boolean(ac14?.differs_from_rfq), ac14?.difference ?? "not flagged");
  const ac19 = R("AC")?.prices.find((p) => p.line_id === "L19");
  const ac19alt = ac19?.alternative_readings.some((a) => Math.abs(a.value - 37.2) < 1e-9 || Math.abs(a.value - 31.2) < 1e-9);
  edge("Anand: L19 pen correction flagged with both readings (31.20 / 37.20)", Boolean(ac19 && ac19.legibility !== "clear" && ac19alt),
    ac19 ? `${ac19.raw_value_text}, ${ac19.legibility}, alternatives ${ac19.alternative_readings.map((a) => a.value).join("/") || "none"}` : "not found");

  const rbFreight = term("RB", "freight", (t) => !t.amount_stated);
  edge("Rohit: 'freight extra' with no amount captured", Boolean(rbFreight), rbFreight?.summary ?? "not found");
  const rb7 = R("RB")?.rateRules.find((x) => x.applies_to_ply === 7 && x.component === "board_per_kg");
  edge("Rohit: 7-ply rate resolved from last year's quote", Boolean(rb7?.from_earlier_record && rb7.value === 44), rb7 ? `${rb7.value_text}/kg from ${rb7.source.file}` : "not found");
  const rbPrint = R("RB")?.rateRules.find((x) => x.component === "printing_per_colour");
  edge("Rohit: printing rate resolved from last year's quote", rbPrint?.value === 0.2, rbPrint ? `${rbPrint.value_text} per colour` : "not found");
  edge("Rohit: no questionnaire returned", (R("RB")?.questionnaire.length ?? 0) === 0, `${R("RB")?.questionnaire.length ?? 0} answers`);
  for (const vid of ["SB", "VP", "KP", "AC"]) {
    const reply = vid === "SB" ? byReply.get("1_shree_balaji_excel") : R(vid);
    edge(`${vid}: questionnaire answers read (8 of 8)`, (reply?.questionnaire.length ?? 0) === 8, `${reply?.questionnaire.length ?? 0} answers`);
  }

  const failures: Check[] = [];
  const fx = (id: string, want: string, why: string) => {
    const r = byReply.get(id);
    failures.push({ name: `${id}: ${why}`, ok: r?.status === want, detail: r ? `${r.status}: ${r.headline}` : "not read" });
  };
  fx("F1_corrupt_quote", "unreadable", "corrupt PDF marked unreadable, resend drafted");
  fx("F2_not_a_quote", "pending", "'rates by Monday' marked pending");
  fx("F3_spam", "ignored", "spam ignored");
  fx("F4_missing_page_quote", "incomplete", "page 1 of 2 flagged, not treated as a 15-line quote");

  return {
    fields: [...tally.values()],
    byVendor: [...vendorTally.entries()].map(([vendor, v]) => ({ vendor, ...v })),
    cells,
    edges,
    failures,
    notYet: [
      "Normalised values (per box, INR, delivered): milestone 2",
      "Which expected doubts are escalated vs only logged: milestone 4",
    ],
    models: [...new Set(readings.flatMap((r) => r.models ?? []))],
  };
}
