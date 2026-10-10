// L22: decision-sensitive doubts. Code only. Every doubt is re-solved with its other reading, in the
// cheapest-overall view and the quality-cleared view; it is raised only if a winner changes there.
// Everything else is logged. Ranked by rupees at stake; routed to the vendor or the buyer (L13).
import { asQuotedPrice, cellKey, solve, type Award, type Grid, type PriceRule } from "./compare";
import { FREIGHT_UNSETTLED } from "./normalise";
import type { SourcingEvent } from "./types";

export interface LineChange {
  lineId: string;
  view: "all" | "cleared";
  from: { vendorId: string; perBox: number } | null;
  to: { vendorId: string; perBox: number } | null;
  /** Rupees: quantity x the difference between the two winning prices. */
  stake: number;
}

/** One cell priced at its other reading: a price, or null to take it out of the running. */
export interface CellPatch { vendorId: string; lineId: string; price: number | null }

export interface Doubt {
  id: string;
  kind: "conditional_discount" | "freight_unknown" | "substitute_spec" | "far_below_should_cost" | "hard_to_read" | "source_failed";
  vendorId: string;
  /** The cells the doubt is about. */
  lineIds: string[];
  title: string;
  why: string;
  /** What we would ask, in one sentence. */
  ask: string;
  route: "vendor" | "buyer";
  /** For a buyer judgement: the choices. */
  options?: string[];
  /** Lines whose winner changes under the other reading. Empty = logged, not raised. */
  changes: LineChange[];
  stake: number;
  /** How the other reading was tried, in words. */
  tested: string;
  /** The other reading, cell by cell, so any scenario can be re-solved with it (see withPatch). */
  patch: CellPatch[];
}

export interface DoubtReport {
  raised: Doubt[];
  logged: Doubt[];
  /** Routine checks code ran and logged (conversions, freight added, last year's rates…); none is a doubt. */
  checks: string[];
  views: { all: Award; cleared: Award };
}

function changes(ev: SourcingEvent, grid: Grid, ids: { all: string[]; cleared: string[] }, base: DoubtReport["views"], alt: PriceRule): LineChange[] {
  const out: LineChange[] = [];
  for (const view of ["all", "cleared"] as const) {
    const a = solve(ev, grid.cells, ids[view], alt);
    for (const l of ev.lines) {
      const from = base[view].per[l.id], to = a.per[l.id];
      if (from?.vendorId === to?.vendorId) continue;
      out.push({ lineId: l.id, view, from, to, stake: Math.abs((to?.perBox ?? 0) - (from?.perBox ?? 0)) * l.qty });
    }
  }
  return out;
}

/** Stake counts each line once, in the view where it costs most. */
const stakeOf = (cs: LineChange[]) => {
  const per = new Map<string, number>();
  for (const c of cs) per.set(c.lineId, Math.max(per.get(c.lineId) ?? 0, c.stake));
  return [...per.values()].reduce((a, b) => a + b, 0);
};

export function findDoubts(ev: SourcingEvent, grid: Grid, cleared: string[]): DoubtReport {
  const ids = { all: grid.vendors.map((v) => v.id), cleared };
  const views = { all: solve(ev, grid.cells, ids.all), cleared: solve(ev, grid.cells, ids.cleared) };
  const name = (v: string) => grid.vendors.find((x) => x.id === v)?.short ?? v;
  type Candidate = Omit<Doubt, "id" | "changes" | "stake">;
  const all: Candidate[] = [];
  // Every other reading is a set of cell prices; everything else stays as quoted.
  const add = (d: Omit<Doubt, "id" | "changes" | "stake" | "patch">, patch: CellPatch[]) => all.push({ ...d, patch });
  const cp = (c: { vendorId: string; lineId: string }, price: number | null): CellPatch => ({ vendorId: c.vendorId, lineId: c.lineId, price });

  for (const v of grid.vendors) {
    const cells = ev.lines.map((l) => grid.cells[cellKey(v.id, l.id)]);
    // A discount that holds only under a condition: what if it applies?
    const disc = cells.find((c) => c.norm.variants.conditionalDiscount)?.norm.variants.conditionalDiscount;
    if (disc) {
      const pct = disc.calc.match(/less ([\d.]+)%/)?.[1];
      add({
        kind: "conditional_discount", vendorId: v.id, lineIds: cells.filter((c) => c.norm.variants.conditionalDiscount).map((c) => c.lineId),
        title: `${name(v.id)}’s ${pct}% discount has a condition: “${disc.when.replace(/^if /, "")}”`,
        why: `The prices are compared without it. Whether it applies depends on how the award is split and how POs are raised.`,
        ask: `Confirm whether the ${pct}% discount applies to monthly call-off POs, and how a single PO is counted.`,
        route: "vendor", tested: `re-solved with ${name(v.id)}’s prices ${pct}% lower`,
      }, cells.filter((c) => c.canWin && c.norm.variants.conditionalDiscount).map((c) => cp(c, c.norm.variants.conditionalDiscount!.value)));
    }
    // Freight extra, amount not given: what if it is what it was last year?
    const lyf = cells.find((c) => c.norm.variants.lastYearFreight)?.norm.variants.lastYearFreight;
    if (lyf) {
      add({
        kind: "freight_unknown", vendorId: v.id, lineIds: cells.filter((c) => c.norm.variants.lastYearFreight).map((c) => c.lineId),
        title: `${name(v.id)}: freight extra, amount not given`,
        why: `Its prices are compared before freight. If freight is the same as last year (${lyf.when.match(/\((.*)\)/)?.[1] ?? "last year’s rate"}), every ${name(v.id)} price rises by that amount; code re-solved the table with it added.`,
        ask: "Confirm the freight per box to Chakan, or a delivered price.",
        route: "vendor", tested: `re-solved with last year’s freight added to ${name(v.id)}’s prices`,
      }, cells.filter((c) => c.canWin && c.norm.variants.lastYearFreight).map((c) => cp(c, c.norm.variants.lastYearFreight!.value)));
    }
    // Freight the reply leaves unsettled and no earlier rate to test with: test the prices out of the running.
    const unsettled = cells.filter((c) => c.perBox != null && !c.norm.variants.lastYearFreight && c.norm.flags.some((f) => FREIGHT_UNSETTLED.test(f)));
    if (!lyf && unsettled.length) {
      const why = unsettled[0].norm.flags.find((f) => FREIGHT_UNSETTLED.test(f))!;
      add({
        kind: "freight_unknown", vendorId: v.id, lineIds: unsettled.map((c) => c.lineId),
        title: `${name(v.id)}: freight not settled`,
        why: `Its prices are compared before freight: ${why}. No earlier freight rate is on record to test with, so code re-solved the table with these prices out of the running.`,
        ask: "Confirm the freight per box to Chakan, or a delivered price.",
        route: "vendor", tested: `re-solved without ${name(v.id)}’s prices that lack freight`,
      }, unsettled.map((c) => cp(c, null)));
    }
    for (const c of cells) {
      const line = ev.lines.find((l) => l.id === c.lineId)!;
      const accept = [cp(c, c.perBox)];
      if (c.perBox != null && c.norm.alternate) {
        add({
          kind: "substitute_spec", vendorId: v.id, lineIds: [c.lineId],
          title: `${name(v.id)} offered a different spec on ${c.lineId}`,
          why: `${c.norm.alternate} It is held out of the comparison until you accept or reject it.`,
          ask: `Accept ${name(v.id)}’s substitute on ${c.lineId} (${line.name}) or hold to the RFQ spec?`,
          route: "buyer", options: ["Reject: hold to the RFQ spec", "Accept the substitute for this award", "Ask the vendor to quote the RFQ spec"],
          tested: `re-solved with the substitute allowed to win`,
        }, accept);
      } else if (c.perBox != null && c.band === "low") {
        add({
          kind: "far_below_should_cost", vendorId: v.id, lineIds: [c.lineId],
          title: `${name(v.id)} ${c.lineId} at ₹${c.perBox.toFixed(2)}/box is ${Math.round(-c.deviation! * 100)}% below should-cost`,
          why: `Should-cost is ₹${line.shouldCost.toFixed(2)}. As written: ${c.norm.asWritten}. It may be a typo; it cannot win until confirmed.`,
          ask: `Confirm the price for ${c.lineId} (${line.name}): ${c.norm.asWritten}.`,
          route: "vendor", tested: "re-solved with the price allowed to win as written",
        }, accept);
      }
      const read = c.norm;
      if (c.perBox != null && read.alternatives.length) {
        for (const a of read.alternatives) {
          add({
            kind: "hard_to_read", vendorId: v.id, lineIds: [c.lineId],
            title: `${name(v.id)} ${c.lineId}: ${read.raw?.text ?? read.asWritten} or ${a.value.toFixed(2)}? ${read.legibility === "corrected_by_hand" ? "Corrected by hand" : "Hard to read"}`,
            why: `${a.reason} Read as ₹${c.perBox.toFixed(2)} a box; the other reading is ₹${a.perBox.toFixed(2)}.`, ask: `Confirm the price for ${c.lineId}: is it ${read.raw?.text} or ${a.value.toFixed(2)}?`,
            route: "vendor", tested: `re-solved at ₹${a.perBox.toFixed(2)}`,
          }, [cp(c, c.canWin ? a.perBox : null)]);
        }
      } else if (c.perBox != null && read.legibility !== "clear") {
        // A number the reader flagged as hard to read but gave no other reading for: test it out of the running.
        add({
          kind: "hard_to_read", vendorId: v.id, lineIds: [c.lineId],
          title: `${name(v.id)} ${c.lineId}: ${read.asWritten} is ${read.legibility === "corrected_by_hand" ? "corrected by hand" : "hard to read"}`,
          why: "The reader marked this number as hard to read and gave no other reading.",
          ask: `Confirm the price for ${c.lineId} (${line.name}).`,
          route: "vendor", tested: "re-solved with this price taken out of the running",
        }, [cp(c, null)]);
      }
    }
  }

  const tested: Doubt[] = all.map((d, i) => {
    const ch = changes(ev, grid, ids, views, patchRule(d.patch));
    return { ...d, id: `D${i + 1}`, changes: ch, stake: stakeOf(ch) };
  });
  const raised = tested.filter((d) => d.changes.length).sort((a, b) => b.stake - a.stake).map((d, i) => ({ ...d, id: `D${i + 1}` }));
  const logged = tested.filter((d) => !d.changes.length).map((d, i) => ({ ...d, id: `L${i + 1}` }));
  return { raised, logged, checks: routineChecks(ev, grid), views };
}

/** The price rule for a patch: patched cells at their other reading, every other cell as quoted. */
export function patchRule(patch: CellPatch[]): PriceRule {
  const m = new Map(patch.map((p) => [cellKey(p.vendorId, p.lineId), p.price]));
  return (c) => (m.has(cellKey(c.vendorId, c.lineId)) ? m.get(cellKey(c.vendorId, c.lineId))! : asQuotedPrice(c));
}

/** The grid with a doubt's other reading in place, so any scenario can be re-solved with it. */
export function withPatch(grid: Grid, patch: CellPatch[]): Grid {
  const cells = { ...grid.cells };
  for (const p of patch) {
    const k = cellKey(p.vendorId, p.lineId), c = cells[k];
    if (c) cells[k] = { ...c, perBox: p.price ?? c.perBox, canWin: p.price != null };
  }
  return { ...grid, cells };
}

/**
 * One number for "checked and logged": every check that ran and cannot change a winner — the doubts
 * tested and logged plus code's routine checks. The Compare card and the Doubts tab both read this.
 */
export const loggedCount = (r: DoubtReport) => r.logged.length + r.checks.length;
export const loggedLabel = (r: DoubtReport) => `${loggedCount(r)} more checked and logged, none changes a winner`;

/** What code checked and settled on its own, one line each, for the "checked and logged" count. */
function routineChecks(ev: SourcingEvent, grid: Grid): string[] {
  const out: string[] = [];
  for (const v of grid.vendors) {
    const cells = ev.lines.map((l) => grid.cells[cellKey(v.id, l.id)]);
    const priced = cells.filter((c) => c.perBox != null);
    if (!priced.length) continue;
    const f = (re: RegExp) => priced.filter((c) => c.norm.flags.some((x) => re.test(x)) || re.test(c.norm.asWritten));
    if (f(/per 100/).length) out.push(`${v.short}: ${f(/per 100/).length} prices per 100 pieces converted to per box`);
    if (f(/quoted in USD/).length) out.push(`${v.short}: ${f(/quoted in USD/).length} USD prices converted at the reference rate`);
    if (f(/freight added/).length) out.push(`${v.short}: ex-works prices, freight added from the reply`);
    if (f(/per kg/).length) out.push(`${v.short}: ${f(/per kg/).length} per-kg prices converted with box weights from the RFQ spec`);
    if (priced.some((c) => c.lastYear && c.kind === "last_year")) out.push(`${v.short}: rates taken from last year's quote where the reply points to it`);
    if (f(/^revised/).length) out.push(`${v.short}: revised offer supersedes the earlier one on ${f(/^revised/).map((c) => c.lineId).join(", ")}`);
    const missing = cells.filter((c) => c.kind === "not_quoted").map((c) => c.lineId);
    if (missing.length) out.push(`${v.short} did not quote ${missing.join(", ")}`);
    for (const c of priced) if (c.lastYear?.note.includes("spec changed")) out.push(`${c.lineId} (${v.short}): ${c.lastYear.note}`);
  }
  return out;
}
