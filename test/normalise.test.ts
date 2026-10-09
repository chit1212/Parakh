// Milestone 2: code puts every price on one basis. Readings are built by hand here (no model),
// and the expected values come from the answer key, so the arithmetic is pinned exactly.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { normalise } from "@/lib/normalise";
import type { ReplyReading } from "@/lib/reader/pipeline";
import { loadEvent, loadHistory } from "@/lib/rfq";

const key = JSON.parse(fs.readFileSync("dataset/06_answer_key/answer_key.json", "utf8"));
const verified = { status: "verified" as const, note: "" };
const src = (file: string) => ({ file, sheet: null, cell: null, page: null, table: null, row: null, snippet: "x", region: null });

function reading(vendorId: string, p: Partial<ReplyReading>): ReplyReading {
  return {
    replyId: `r-${vendorId}`, vendorId, vendorName: null, status: "read", headline: "", nextStep: { kind: "none", text: "" },
    classification: null, prices: [], rateRules: [], notQuoted: [], terms: [], questionnaire: [], qualityDocs: [], revision: null,
    readingNotes: [], coverage: { quoted: [], missing: [], total: 30 }, unsourced: 0, usage: [], cached: false, ms: 0, readAt: null, models: [],
    ...p,
  };
}

const price = (line: string, value: number, unit: string, currency: string, basis: string, extra: object = {}) => ({
  vendor_wording: line, line_id: line, match_basis: "line_id_given" as const, match_reason: "", raw_value_text: String(value), raw_value: value,
  unit, unit_text: unit, currency, price_basis: basis, offered_spec: null, differs_from_rfq: false, difference: null,
  legibility: "clear" as const, alternative_readings: [], source: src("q"), verification: verified, ...extra,
}) as ReplyReading["prices"][number];

const term = (kind: string, value: number | null, value_unit: string, extra: object = {}) => ({
  kind, summary: kind, value, value_unit, applies_to: null, amount_stated: value !== null, condition: null, condition_threshold_inr: null,
  source: src("q"), verification: verified, ...extra,
}) as ReplyReading["terms"][number];

const rule = (component: string, value: number, ply: number | null, from_earlier_record = false) => ({
  vendor_wording: "", component, applies_to_ply: ply, value, value_text: String(value), currency: "INR", unit_text: "", from_earlier_record,
  pointer: from_earlier_record ? "rest same as last year" : null, source: src("q"), verification: verified,
}) as ReplyReading["rateRules"][number];

async function cell(r: ReplyReading, line: string) {
  const [ev, history] = await Promise.all([loadEvent(), loadHistory()]);
  return normalise(ev, [r], history)[0].cells.find((c) => c.lineId === line)!;
}

describe("one basis: INR per box, delivered", () => {
  it("per 100 pieces, ex-works, plus freight with 15% handling (Kaveri L01)", async () => {
    const c = await cell(reading("KP", {
      prices: [price("L01", 446, "per_100", "INR", "ex_works")],
      terms: [term("freight", 0.4, "inr_per_box"), term("handling", 15, "percent", { applies_to: "transportation charges" })],
    }), "L01");
    expect(c.perBox).toBe(key.cells["KP|L01"].normalised);
    expect(c.calc).toBe("446.00 / 100 + 0.40 freight x 1.15 (15% handling)");
    expect(c.asWritten).toBe("Rs 446 per 100 pcs, ex-works");
  });

  it("USD at the reference rate, with the conditional discount kept apart (Vardhman L03)", async () => {
    const c = await cell(reading("VP", {
      prices: [price("L03", 0.0475, "per_box", "USD", "delivered")],
      terms: [term("discount", 2.5, "percent", { condition: "a single PO exceeds INR 25,00,000" })],
    }), "L03");
    expect(c.perBox).toBe(key.cells["VP|L03"].normalised);
    expect(c.variants.conditionalDiscount?.value).toBe(key.cells["VP|L03"].with_conditional_discount);
    expect(c.flags.join(" ")).toMatch(/quoted in USD/);
  });

  it("per kg from the RFQ weight, last year's printing and 7-ply rate, freight unknown (Rohit L21)", async () => {
    const c = await cell(reading("RB", {
      rateRules: [rule("board_per_kg", 44, 7, true), rule("printing_per_colour", 0.2, null, true), rule("die_cutting_per_piece", 0.15, null, true)],
      terms: [term("freight", null, "none", { amount_stated: false })],
    }), "L21");
    expect(c.perBox).toBe(key.cells["RB|L21"].normalised);
    expect(c.lastYear).toBe(true);
    expect(c.variants.lastYearFreight?.value).toBe(key.cells["RB|L21"].with_ly_freight);
    expect(c.flags.join(" ")).toMatch(/freight extra, amount not given/);
  });

  it("never guesses: an unclear unit or a missing currency leaves the cell unpriced", async () => {
    const unit = await cell(reading("AC", { prices: [price("L01", 5, "unclear", "INR", "delivered")] }), "L01");
    expect(unit.status).toBe("unclear");
    expect(unit.perBox).toBeNull();
    const cur = await cell(reading("AC", { prices: [price("L01", 5, "per_box", "not_stated", "delivered")] }), "L01");
    expect(cur.status).toBe("unclear");
    expect(cur.flags.join(" ")).toMatch(/No currency/);
  });

  it("a value whose source failed the check never enters", async () => {
    const c = await cell(reading("AC", { prices: [price("L01", 5, "per_box", "INR", "delivered", { verification: { status: "failed", note: "" } })] }), "L01");
    expect(c.status).toBe("not_quoted");
    expect(c.perBox).toBeNull();
  });

  it("converts the other readings of a doubtful number too, so a doubt can be re-solved", async () => {
    const c = await cell(reading("AC", {
      prices: [price("L19", 31.2, "per_box", "INR", "delivered", { legibility: "corrected_by_hand", alternative_readings: [{ value: 37.2, reason: "1 could be 7" }] })],
    }), "L19");
    expect(c.perBox).toBe(31.2);
    expect(c.alternatives).toEqual([{ value: 37.2, perBox: 37.2, reason: "1 could be 7" }]);
  });
});
