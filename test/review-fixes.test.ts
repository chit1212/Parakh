// Review fixes, regression tests (1.4): YoY drivers from the shared fact store, an exact share cap,
// and a premium measured against the right baseline.
import { describe, expect, it } from "vitest";
import { buildGrid } from "@/lib/compare";
import { cheaperMove } from "@/lib/allocate";
import { shares, yoyDrivers } from "@/lib/facts";
import { loadDemoInbox } from "@/lib/inbox";
import { qualityOf } from "@/lib/quality";
import { loadEvent, loadHistory } from "@/lib/rfq";
import { loadSavedReadings } from "@/lib/saved";
import { LIBRARY, runScenario } from "@/lib/scenario";

describe("review fixes: analytical correctness", async () => {
  const [ev, inbox, history] = await Promise.all([loadEvent(), loadDemoInbox(), loadHistory()]);
  const readings = Object.values(await loadSavedReadings(inbox));
  const grid = buildGrid(ev, readings, history, {}, history.lines);
  const quality = ev.vendors.map((v) => qualityOf(ev, v.id, readings));
  const s1 = LIBRARY.find((x) => x.key === "S1")!.rules;
  const qual = runScenario(ev, grid, quality, s1);

  it("five biggest contributors to the YoY increase among quality-cleared vendors", () => {
    const y = yoyDrivers(ev, qual.award, history.lines, 5);
    expect(y.top).toHaveLength(5);
    expect(y.comparableLines).toBe(ev.lines.filter((l) => history.lines.some((h) => h.lineId === l.id) && qual.award.per[l.id]).length);
    for (const d of y.top) expect(d.amount).toBeCloseTo((qual.award.per[d.lineId]!.perBox - history.lines.find((h) => h.lineId === d.lineId)!.price) * d.qty, 6);
    expect([...y.top].sort((a, b) => b.amount - a.amount)).toEqual(y.top);
  });

  it("a 37% cap is solved exactly: no profitable single move, and L26 stays with the cheaper vendor", () => {
    const cap = runScenario(ev, grid, quality, { ...s1, cap: 0.37 });
    expect(cap.status).toBe("proven_optimal");
    expect(cap.selfCheck.passed).toBe(true);
    for (const v of Object.values(cap.award.byVendor)) expect(v.value).toBeLessThanOrEqual(0.37 * cap.award.total + 1e-6);
    const lines = ev.lines.map((l) => ({ lineId: l.id, qty: l.qty, options: grid.vendors.filter((v) => !cap.excluded.some((e) => e.vendorId === v.id)).map((v) => ({ v: v.id, p: cap.award.per[l.id] && grid.cells[`${v.id}|${l.id}`].canWin ? grid.cells[`${v.id}|${l.id}`].perBox! : NaN })).filter((o) => Number.isFinite(o.p)) }));
    const pick = Object.fromEntries(ev.lines.map((l) => [l.id, cap.award.per[l.id] ? { v: cap.award.per[l.id]!.vendorId, p: cap.award.per[l.id]!.perBox } : null]));
    expect(cheaperMove(lines, pick, 0.37, null)).toBeNull();
    // The reviewed heuristic gave L26 to Kaveri; the exact result is at least ₹10,660 cheaper than that.
    const sb = grid.cells["SB|L26"].perBox!, kp = grid.cells["KP|L26"].perBox!;
    expect(sb).toBeLessThan(kp);
    expect(cap.award.per.L26?.vendorId).not.toBe("KP");
  });

  it("the 37% cap's premium is measured against quality-cleared cheapest per line, with every share", () => {
    const cap = runScenario(ev, grid, quality, { ...s1, cap: 0.37 });
    const premium = cap.award.total - qual.award.total;
    expect(premium).toBeGreaterThan(0);
    expect(premium).toBeLessThan(cap.award.total - cap.base.total); // not the all-vendor baseline
    const sh = shares(grid, cap.award);
    expect(sh.reduce((a, s) => a + s.pct, 0)).toBeCloseTo(1, 6);
    expect(sh.every((s) => s.pct <= 0.37 + 1e-9)).toBe(true);
  });
});
