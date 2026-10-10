// Review fix 2.5: an award cannot be submitted while blockers remain, on the screen or through the API.
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/award/submit/route";
import { awardState, blockersOf, freeze } from "@/lib/award";
import { buildGrid } from "@/lib/compare";
import { findDoubts, withPatch } from "@/lib/doubts";
import { loadDemoInbox } from "@/lib/inbox";
import { qualityOf } from "@/lib/quality";
import { loadEvent, loadHistory } from "@/lib/rfq";
import { loadSavedReadings } from "@/lib/saved";
import { LIBRARY, runScenario } from "@/lib/scenario";

describe("award blockers", async () => {
  const [ev, inbox, history] = await Promise.all([loadEvent(), loadDemoInbox(), loadHistory()]);
  const readings = Object.values(await loadSavedReadings(inbox));
  const grid = buildGrid(ev, readings, history, {}, history.lines);
  const quality = ev.vendors.map((v) => qualityOf(ev, v.id, readings));
  const report = findDoubts(ev, grid, quality.filter((q) => q.cleared).map((q) => q.vendorId));
  const rules = LIBRARY.find((x) => x.key === "S1")!.rules;
  const r = runScenario(ev, grid, quality, rules);
  const affecting = report.raised.map((d) => {
    const alt = runScenario(ev, withPatch(grid, d.patch), quality, rules).award;
    return { title: d.title, lineIds: ev.lines.filter((l) => alt.per[l.id]?.vendorId !== r.award.per[l.id]?.vendorId).map((l) => l.id) };
  }).filter((d) => d.lineIds.length);
  const pendingVendors = [...new Set(report.raised.filter((d) => d.kind === "freight_unknown").map((d) => d.vendorId))];
  const draft = freeze({ ev, grid, quality, report, lastYear: history.lines, scenario: { title: "Cheapest per line, quality-cleared only", result: r }, decisions: [], affecting, pendingVendors });
  const post = (snapshot: unknown) => POST(new Request("http://x/api/award/submit", { method: "POST", body: JSON.stringify({ snapshot }) }));

  it("open doubts in the saved scenario block submission; the state is Draft", async () => {
    expect(blockersOf(draft).some((b) => b.kind === "doubt")).toBe(true);
    expect(awardState(draft)).toBe("draft");
    const res = await post(draft);
    expect(res.status).toBe(409);
    expect((await res.json()).blockers.length).toBe(blockersOf(draft).length);
  });

  it("with no blockers it is In review, and the server accepts it", async () => {
    const clean = { ...draft, rows: draft.rows.map((x) => ({ ...x, doubt: null, freightPending: false })) };
    expect(blockersOf(clean)).toEqual([]);
    expect(awardState(clean)).toBe("in_review");
    const res = await post(clean);
    expect(res.status).toBe(200);
    expect((await res.json()).sentAt).toBeTruthy();
  });

  it("freight pending on a winning line blocks too", () => {
    const withFreight = { ...draft, rows: draft.rows.map((x, i) => ({ ...x, doubt: null, freightPending: i === 0 })) };
    expect(blockersOf(withFreight).map((b) => b.kind)).toEqual(["freight"]);
  });
});
