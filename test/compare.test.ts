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
  const grid = buildGrid(ev, Object.values(saved), history, {});

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
});
