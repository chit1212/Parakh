// The buyer's recorded decisions take effect in code: an approved held price may win; a held one may not.
import { describe, expect, it } from "vitest";
import { buildGrid, cellKey } from "@/lib/compare";
import { applyDecisions, decisionKey, parseDecisions, type Decision } from "@/lib/decisions";
import { findDoubts } from "@/lib/doubts";
import { loadDemoInbox } from "@/lib/inbox";
import { qualityOf } from "@/lib/quality";
import { loadEvent, loadHistory } from "@/lib/rfq";
import { loadSavedReadings } from "@/lib/saved";

describe("decisions on doubts", async () => {
  const [ev, inbox, history] = await Promise.all([loadEvent(), loadDemoInbox(), loadHistory()]);
  const readings = Object.values(await loadSavedReadings(inbox));
  const grid = buildGrid(ev, readings, history, {}, history.lines);
  const cleared = ev.vendors.map((v) => qualityOf(ev, v.id, readings)).filter((q) => q.cleared).map((q) => q.vendorId);
  const report = findDoubts(ev, grid, cleared);
  const kaveri = report.raised.find((d) => d.kind === "far_below_should_cost" && d.vendorId === "KP")!;
  const decide = (effect: Decision["effect"]): Decision => ({
    key: decisionKey(kaveri), title: kaveri.title, vendorId: "KP", lineIds: kaveri.lineIds, choice: "test", effect, who: "Vikram Deshpande", at: "2026-10-10T10:00:00Z", why: "confirmed on the phone",
  });

  it("Kaveri L09 is held out until the buyer decides", () => {
    expect(grid.cells[cellKey("KP", "L09")].canWin).toBe(false);
    expect(grid.asQuoted.per.L09?.vendorId).not.toBe("KP");
  });

  it("approving it lets it win the line, and the doubt is no longer raised", () => {
    const g = applyDecisions(ev, grid, [decide("accept")]);
    expect(g.cells[cellKey("KP", "L09")].canWin).toBe(true);
    expect(g.asQuoted.per.L09?.vendorId).toBe("KP");
    expect(findDoubts(ev, g, cleared).raised.some((d) => d.vendorId === "KP" && d.lineIds.includes("L09"))).toBe(false);
  });

  it("holding it changes nothing", () => {
    const g = applyDecisions(ev, grid, [decide("hold")]);
    expect(g.asQuoted.per.L09?.vendorId).toBe(grid.asQuoted.per.L09?.vendorId);
  });

  it("ignores malformed decisions from the browser", () => {
    expect(parseDecisions([{ key: 1 }, null, decide("accept")])).toHaveLength(1);
    expect(parseDecisions("nope")).toEqual([]);
  });
});
