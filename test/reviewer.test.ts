// Reviewer polish: one "checked and logged" number, doubts re-tested in the view on screen,
// Anand's score worked out from his answers, and L19 logged rather than raised.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildGrid, cellKey } from "@/lib/compare";
import { findDoubts, loggedCount, loggedLabel, withPatch } from "@/lib/doubts";
import { loadDemoInbox } from "@/lib/inbox";
import { qualityOf } from "@/lib/quality";
import { loadEvent, loadHistory } from "@/lib/rfq";
import { loadSavedReadings } from "@/lib/saved";
import { LIBRARY, runScenario } from "@/lib/scenario";

describe("reviewer polish", async () => {
  const [ev, inbox, history] = await Promise.all([loadEvent(), loadDemoInbox(), loadHistory()]);
  const readings = Object.values(await loadSavedReadings(inbox));
  const grid = buildGrid(ev, readings, history, {}, history.lines);
  const quality = ev.vendors.map((v) => qualityOf(ev, v.id, readings));
  const report = findDoubts(ev, grid, quality.filter((q) => q.cleared).map((q) => q.vendorId));
  const s1 = LIBRARY.find((x) => x.key === "S1")!.rules;

  it("the Compare card and the Doubts tab read one logged count", () => {
    expect(loggedCount(report)).toBe(report.logged.length + report.checks.length);
    expect(loggedLabel(report)).toBe(`${loggedCount(report)} more checked and logged, none changes a winner`);
    // Both screens print the shared label, not their own count.
    for (const f of ["src/app/events/[id]/compare/page.tsx", "src/components/DoubtsView.tsx"]) {
      const src = readFileSync(f, "utf8");
      expect(src).toContain("loggedLabel(report)");
      expect(src).not.toMatch(/report\.logged\.length/);
    }
  });

  it("a doubt's patch reproduces the test it was raised on", () => {
    for (const d of report.raised) {
      const alt = runScenario(ev, withPatch(grid, d.patch), quality, { eligible: "all" }).award;
      const flips = ev.lines.filter((l) => alt.per[l.id]?.vendorId !== report.views.all.per[l.id]?.vendorId).map((l) => l.id);
      expect(flips.sort()).toEqual([...new Set(d.changes.filter((c) => c.view === "all").map((c) => c.lineId))].sort());
    }
  });

  it("Vardhman's discount marks only the lines it flips in the view on screen", () => {
    const disc = report.raised.find((d) => d.kind === "conditional_discount" && d.vendorId === "VP")!;
    const now = runScenario(ev, grid, quality, s1).award;
    const alt = runScenario(ev, withPatch(grid, disc.patch), quality, s1).award;
    const flips = ev.lines.filter((l) => alt.per[l.id]?.vendorId !== now.per[l.id]?.vendorId);
    expect(flips.length).toBeGreaterThan(0);
    expect(flips.length).toBeLessThan(new Set(disc.changes.map((c) => c.lineId)).size);
    expect(flips.every((l) => alt.per[l.id]?.vendorId === "VP")).toBe(true);
  });

  it("Anand's score is worked out from his answers against the marking scheme", () => {
    const q = quality.find((x) => x.vendorId === "AC")!;
    expect(q.score).toBe(q.items.reduce((a, x) => a + x.pts, 0));
    expect(q.mandatoryFailed).toBe(2);
    expect(q.cleared).toBe(false);
  });

  it("Anand L19 has two readings, is logged, and changes no winner in the quality-cleared view", () => {
    const c = grid.cells[cellKey("AC", "L19")];
    expect(c.norm.alternatives.length).toBeGreaterThan(0);
    const d = report.logged.find((x) => x.kind === "hard_to_read" && x.vendorId === "AC" && x.lineIds.includes("L19"));
    expect(d).toBeTruthy();
    expect(report.raised.some((x) => x.kind === "hard_to_read" && x.lineIds.includes("L19"))).toBe(false);
    const now = runScenario(ev, grid, quality, s1).award;
    const alt = runScenario(ev, withPatch(grid, d!.patch), quality, s1).award;
    expect(alt.per.L19?.vendorId).toBe(now.per.L19?.vendorId);
  });
});
