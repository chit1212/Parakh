// The as-quoted comparison, built from the saved readings (the real pipeline's output) and code,
// against the answer key's "cheapest per line, all vendors" result.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import { buildGrid } from "@/lib/compare";
import { loadDemoInbox } from "@/lib/inbox";
import { loadEvent, loadHistory } from "@/lib/rfq";
import { loadSavedReadings } from "@/lib/saved";

const key = JSON.parse(fs.readFileSync("dataset/06_answer_key/answer_key.json", "utf8"));

describe("comparison, as quoted", async () => {
  const [ev, inbox, history] = await Promise.all([loadEvent(), loadDemoInbox(), loadHistory()]);
  const saved = await loadSavedReadings(inbox);
  const grid = buildGrid(ev, Object.values(saved), history, {}, history.lines);

  it("picks the same winner as the answer key on every line", () => {
    const want = key.scenarios.cheapest_overall_all_vendors.winners as Record<string, string>;
    const got = Object.fromEntries(ev.lines.map((l) => [l.id, grid.asQuoted.per[l.id]?.vendorId ?? null]));
    expect(got).toEqual(want);
  });

  it("totals within a rupee per line of the answer key", () => {
    expect(Math.abs(grid.asQuoted.total - key.scenarios.cheapest_overall_all_vendors.total_inr)).toBeLessThan(5000);
  });

  it("holds back the substitute spec and the price far below should-cost", () => {
    expect(grid.cells["AC|L14"].canWin).toBe(false);
    expect(grid.cells["KP|L09"].canWin).toBe(false);
    expect(grid.cells["KP|L09"].band).toBe("low");
  });

  it("explains L21's jump against last year by its spec change, and finds no history for new SKUs", () => {
    const c = grid.cells["SB|L21"];
    expect(c.lastYear!.delta).toBeGreaterThan(0.6);
    expect(c.lastYear!.note).toMatch(/spec changed from 5-ply/);
    expect(grid.cells["SB|L28"].lastYear).toBeNull();
    expect(grid.cells["SB|L29"].lastYear).toBeNull();
    expect(Object.values(grid.cells).filter((x) => x.unitWarning)).toEqual([]);
  });
});

describe("scenarios, solved in code", async () => {
  const { runScenario } = await import("@/lib/scenario");
  const { qualityOf } = await import("@/lib/quality");
  const [ev, inbox, history] = await Promise.all([loadEvent(), loadDemoInbox(), loadHistory()]);
  const rd = Object.values(await loadSavedReadings(inbox));
  const grid = buildGrid(ev, rd, history, {}, history.lines);
  const q = ev.vendors.map((v) => qualityOf(ev, v.id, rd));

  it("the VP's question: quality-cleared, cheapest per line", () => {
    const r = runScenario(ev, grid, q, { eligible: "quality_cleared" });
    expect(Math.abs(r.award.total - key.scenarios.cheapest_per_line_quality_cleared.total_inr)).toBeLessThan(5000);
    expect(Object.fromEntries(ev.lines.map((l) => [l.id, r.award.per[l.id]?.vendorId]))).toEqual(key.scenarios.cheapest_per_line_quality_cleared.winners);
    expect(r.excluded.map((e) => e.vendorId).sort()).toEqual(["AC", "RB"]);
  });

  it("the same if Vardhman's discount applies, and with Rohit at last year's freight", () => {
    const d = runScenario(ev, grid, q, { eligible: "quality_cleared", assumeDiscounts: true });
    expect(Math.abs(d.award.total - key.scenarios.quality_cleared_if_vardhman_discount_applies.total_inr)).toBeLessThan(5000);
    const f = runScenario(ev, grid, q, { eligible: "all", freight: "last_year" });
    expect(Math.abs(f.award.total - key.scenarios.all_vendors_with_rohit_ly_freight.total_inr)).toBeLessThan(5000);
  });

  it("a 40% cap keeps every vendor at or under 40% of value", () => {
    const r = runScenario(ev, grid, q, { eligible: "quality_cleared", cap: 0.4 });
    for (const v of Object.values(r.award.byVendor)) expect(v.value).toBeLessThanOrEqual(0.4 * r.award.total + 1);
  });
});
