// The answer key is test-only: it checks code, the app never reads it.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { loadEvent, loadHistory } from "@/lib/rfq";

const key = JSON.parse(fs.readFileSync("dataset/06_answer_key/answer_key.json", "utf8"));

describe("RFQ lines from the buyer's template", () => {
  it("reads all 30 lines with quantities and specs", async () => {
    const ev = await loadEvent();
    expect(ev.lines).toHaveLength(30);
    for (const k of key.lines) {
      const l = ev.lines.find((x) => x.id === k.id)!;
      expect(l.qty, k.id).toBe(k.qty);
      expect(l.spec, k.id).toBe(k.spec);
      expect(l.plyN, k.id).toBe(k.ply_n);
      expect(l.colours, k.id).toBe(k.colours);
    }
  });

  it("computes area, weight and should-cost in code, matching the key", async () => {
    const ev = await loadEvent();
    for (const k of key.lines) {
      const l = ev.lines.find((x) => x.id === k.id)!;
      expect(l.areaM2, k.id).toBeCloseTo(k.area_m2, 3);
      expect(l.weightKg, k.id).toBeCloseTo(k.weight_kg, 3);
      expect(l.shouldCost, k.id).toBeCloseTo(k.should_cost, 2);
    }
  });

  it("reads the questionnaire", async () => {
    const ev = await loadEvent();
    expect(ev.questions.map((q) => q.id)).toEqual(["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7", "Q8"]);
    expect(ev.questions.filter((q) => q.type === "Mandatory").map((q) => q.id)).toEqual(["Q1", "Q2"]);
  });
});

describe("last year's award", () => {
  it("has 28 lines (no history for the two new SKUs) with cell references", async () => {
    const h = await loadHistory();
    expect(h.lines).toHaveLength(28);
    expect(h.lines.find((l) => l.lineId === "L28")).toBeUndefined();
    const l21 = h.lines.find((l) => l.lineId === "L21")!;
    expect(l21.board).toBe("5-ply BC");
    expect(l21.source.cell).toBe("E23");
  });
});
