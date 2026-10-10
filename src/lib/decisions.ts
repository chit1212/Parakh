// The buyer's recorded decisions on doubts (who, when, why), and their effect on the table.
// A decision is the buyer's, never the AI's: accepting a substitute spec or approving a price far
// below should-cost lets that price compete; holding it keeps it out. Code applies the effect.
import { cellKey, solve, type Grid } from "./compare";
import type { Doubt } from "./doubts";
import type { SourcingEvent } from "./types";

export interface Decision {
  /** Which doubt: kind, vendor and lines (stable across re-reads, unlike its title). */
  key: string;
  title: string;
  vendorId: string;
  lineIds: string[];
  /** What was decided, in words. */
  choice: string;
  /** "accept": the held price may win. "hold": it stays out. "asked": the vendor was asked. */
  effect: "accept" | "hold" | "asked";
  who: string;
  at: string;
  why: string;
}

export const DECISIONS_KEY = "parakh.decisions.v2";
export const decisionKey = (d: Pick<Doubt, "kind" | "vendorId" | "lineIds">) => `${d.kind}:${d.vendorId}:${d.lineIds.join(",")}`;

/** Doubts the buyer can settle by accepting the price that is held out of the running. */
export const acceptable = (d: Pick<Doubt, "kind">) => d.kind === "substitute_spec" || d.kind === "far_below_should_cost";

/** The table with the buyer's accepted prices allowed to win; everything else as read. */
export function applyDecisions(ev: SourcingEvent, grid: Grid, decisions: Decision[]): Grid {
  const accepted = decisions.filter((d) => d.effect === "accept");
  if (!accepted.length) return grid;
  const cells = { ...grid.cells };
  for (const d of accepted)
    for (const l of d.lineIds) {
      const c = cells[cellKey(d.vendorId, l)];
      if (!c || c.perBox == null || c.canWin) continue;
      cells[cellKey(d.vendorId, l)] = {
        ...c, canWin: true, whyNot: null,
        norm: { ...c.norm, flags: [...c.norm.flags, `approved to compete by ${d.who}: ${d.why}`] },
      };
    }
  return { ...grid, cells, asQuoted: solve(ev, cells, grid.vendors.map((v) => v.id)) };
}

/** Decisions as stored, checked for shape (they come from the browser). */
export function parseDecisions(x: unknown): Decision[] {
  if (!Array.isArray(x)) return [];
  return x.filter((d): d is Decision =>
    !!d && typeof d.key === "string" && typeof d.vendorId === "string" && Array.isArray(d.lineIds) && ["accept", "hold", "asked"].includes(d.effect) && typeof d.who === "string" && typeof d.at === "string");
}
