// The source checker is code, independent of the model: it must accept true citations
// and reject wrong ones, for every file format in the dataset.
import { describe, expect, it } from "vitest";
import { loadDemoInbox } from "@/lib/inbox";
import { loadHistory } from "@/lib/rfq";
import { verifySource } from "@/lib/reader/verify";
import type { Reply, SourceRef } from "@/lib/types";

const src = (p: Partial<SourceRef> & { file: string; snippet: string }): SourceRef => ({
  sheet: null, cell: null, page: null, table: null, row: null, region: null, ...p,
});
const filesOf = (r: Reply) => [...(r.cover ? [r.cover] : []), ...r.files];
const reply = async (id: string) => (await loadDemoInbox()).find((r) => r.id === id)!;

describe("source check: spreadsheet", () => {
  it("accepts the right cell and rejects a wrong one", async () => {
    const f = filesOf(await reply("1_shree_balaji_excel"));
    const good = src({ file: "SBC_Offer_0418_SE-2026-041.xlsx", sheet: "Offer", cell: "G8", snippet: "4.65" });
    expect(verifySource(good, f, [], { valueText: "4.65", value: 4.65 }).status).toBe("verified");
    const wrong = { ...good, cell: "G9" };
    expect(verifySource(wrong, f, [], { valueText: "4.65", value: 4.65 }).status).toBe("failed");
    const terms = src({ file: "SBC_Offer_0418_SE-2026-041.xlsx", sheet: "T&C", cell: "B3", snippet: "Rs 0.35 per box to Chakan, billed in invoice" });
    expect(verifySource(terms, f, [], { value: 0.35 }).status).toBe("verified");
  });
});

describe("source check: Word", () => {
  it("finds a table row by number or by line label, and a paragraph by its words", async () => {
    const f = filesOf(await reply("3_kaveri_word"));
    const file = "Kaveri_Quotation_SE-2026-041.docx";
    expect(verifySource(src({ file, table: 1, row: "2", snippet: "446.00" }), f, [], { valueText: "446.00", value: 446 }).status).toBe("verified");
    expect(verifySource(src({ file, table: 1, row: "L09", snippet: "579.00" }), f, [], { valueText: "579.00", value: 579 }).status).toBe("verified");
    expect(verifySource(src({ file, table: 1, row: "L09", snippet: "579.00" }), f, [], { valueText: "597.00", value: 597 }).status).toBe("failed");
    const freight = src({ file, snippet: "at Rs. 0.40 per box, on which a handling charge of 15% will be added" });
    expect(verifySource(freight, f, [], { value: 0.4 }).status).toBe("verified");
    expect(verifySource({ ...freight, snippet: "free delivery to Chakan" }, f, []).status).toBe("failed");
  });
});

describe("source check: PDF", () => {
  it("finds a price on the stated page and rejects the wrong page", async () => {
    const f = filesOf(await reply("2_vardhman_pdf"));
    const file = "Vardhman_Quotation_VPE-Q-2611.pdf";
    const s = src({ file, page: 1, row: "L01", snippet: "L01 Steam iron, unit carton 3-ply E, 4 col 156,000 0.0551" });
    expect(verifySource(s, f, [], { valueText: "0.0551", value: 0.0551 }, "L01").status).toBe("verified");
    expect(verifySource({ ...s, page: 2 }, f, [], { valueText: "0.0551", value: 0.0551 }, "L01").status).toBe("failed");
    const disc = src({ file, page: 3, snippet: "A trade discount of 2.5% applies on the invoice value of all items" });
    expect(verifySource(disc, f, [], { value: 2.5 }).status).toBe("verified");
  });
});

describe("source check: email, photo, buyer records", () => {
  it("checks a sentence in an email body", async () => {
    const f = filesOf(await reply("5_rohit_email"));
    const s = src({ file: "Re_RFQ_SE-2026-041.eml", snippet: "₹42/kg for the 5-ply, 38 for the 3-ply, rest same as last year, freight extra." });
    expect(verifySource(s, f, [], { valueText: "42", value: 42 }).status).toBe("verified");
    expect(verifySource(s, f, [], { valueText: "44", value: 44 }).status).toBe("failed");
  });
  it("marks a photo as not checkable by code", async () => {
    const f = filesOf(await reply("4_anand_photo"));
    expect(verifySource(src({ file: "Anand_RateCard_photo.jpg", row: "13", snippet: "8.85" }), f, []).status).toBe("photo");
  });
  it("checks a rate taken from last year's record", async () => {
    const h = await loadHistory();
    const rec = [{ file: h.file, sheets: h.sheets }];
    const s = src({ file: "SE-2025-037_Award_Summary.xlsx", sheet: "Rohit Box quote FY26 H2", cell: "B5", snippet: "44" });
    expect(verifySource(s, [], rec, { valueText: "44", value: 44 }).status).toBe("verified");
  });
  it("rejects a file that is not in the reply", async () => {
    const f = filesOf(await reply("5_rohit_email"));
    expect(verifySource(src({ file: "made_up.pdf", page: 1, snippet: "x" }), f, []).status).toBe("failed");
  });
});

describe("failure cases, before any model call", () => {
  it("cannot open the corrupt PDF", async () => {
    const r = await reply("F1_corrupt_quote");
    expect(r.files[0].parseError).toBeTruthy();
  });
  it("sees that the half-quote says page 1 of 2 but has one page", async () => {
    const r = await reply("F4_missing_page_quote");
    expect(r.files[0].pdfPages).toHaveLength(1);
    expect(r.files[0].pdfPages![0]).toMatch(/Page 1 of 2/);
  });
});
