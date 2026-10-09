// L25: what-if scenarios, solved in code. The analyst chat chooses the rules; this does every sum.
import { asQuotedPrice, cellKey, solve, type Award, type Grid, type GridCell, type PriceRule } from "./compare";
import type { Quality } from "./quality";
import type { SourcingEvent } from "./types";

export interface ScenarioRules {
  /** "all" vendors, or only those that cleared the quality questionnaire. */
  eligible: "all" | "quality_cleared";
  /** Vendors left out by name (vendor ids), with the buyer's reason. */
  exclude?: { vendorId: string; reason: string }[];
  /** Apply conditional discounts as if their condition is met. */
  assumeDiscounts?: boolean;
  /** Where freight is unknown: leave it out ("as_read"), or add last year's freight. */
  freight?: "as_read" | "last_year";
  /** Let substitute specs and prices far below should-cost win as quoted. */
  acceptHeld?: boolean;
  /** Price every open doubt against us: no conditional discounts, last year's freight, held cells out. */
  worstCase?: boolean;
  /** No vendor above this share of the award value (0-1). */
  cap?: number | null;
  /** Lines fixed to a vendor by the buyer. */
  overrides?: { lineId: string; vendorId: string }[];
}

export interface ScenarioResult {
  rules: string[];
  excluded: { vendorId: string; name: string; why: string }[];
  award: Award;
  base: Award;
  changed: { lineId: string; from: string | null; to: string | null; delta: number; deltaValue: number }[];
  /** Lines moved by the cap, if any. */
  moved: number;
  /** Doubts that still matter under these rules, in words. */
  notes: string[];
}

export function runScenario(ev: SourcingEvent, grid: Grid, quality: Quality[], r: ScenarioRules): ScenarioResult {
  const name = (v: string) => grid.vendors.find((x) => x.id === v)?.short ?? v;
  const excluded: ScenarioResult["excluded"] = [];
  if (r.eligible === "quality_cleared")
    for (const q of quality) if (!q.cleared) excluded.push({ vendorId: q.vendorId, name: grid.vendors.find((v) => v.id === q.vendorId)!.name, why: q.why });
  for (const x of r.exclude ?? [])
    if (!excluded.some((e) => e.vendorId === x.vendorId) && grid.vendors.some((v) => v.id === x.vendorId))
      excluded.push({ vendorId: x.vendorId, name: grid.vendors.find((v) => v.id === x.vendorId)!.name, why: x.reason });
  const ids = grid.vendors.map((v) => v.id).filter((v) => !excluded.some((e) => e.vendorId === v));

  const freight = r.worstCase ? "last_year" : r.freight ?? "as_read";
  const price: PriceRule = (c: GridCell) => {
    if (c.perBox == null) return null;
    const held = !c.canWin;
    if (held && (r.worstCase || !r.acceptHeld)) return null;
    let p = c.perBox;
    if (r.assumeDiscounts && !r.worstCase && c.norm.variants.conditionalDiscount) p = c.norm.variants.conditionalDiscount.value;
    if (freight === "last_year" && c.norm.variants.lastYearFreight) p = c.norm.variants.lastYearFreight.value;
    return p;
  };
  const fixed = new Map((r.overrides ?? []).map((o) => [o.lineId, o.vendorId]));
  const withOverrides: PriceRule = (c) => {
    const f = fixed.get(c.lineId);
    if (f) return c.vendorId === f && c.perBox != null ? price(c) ?? c.perBox : null;
    return price(c);
  };

  // Cheapest per line, then a share cap if asked: move the cheapest-to-move line off any vendor over the cap.
  const options = ev.lines.map((l) =>
    ids.map((v) => ({ v, p: withOverrides(grid.cells[cellKey(v, l.id)]) })).filter((o): o is { v: string; p: number } => o.p != null).sort((a, b) => a.p - b.p),
  );
  const pick = options.map(() => 0);
  let moved = 0;
  const tally = (): Award => {
    const per: Award["per"] = {};
    const byVendor: Award["byVendor"] = Object.fromEntries(grid.vendors.map((v) => [v.id, { lines: 0, value: 0 }]));
    let total = 0;
    ev.lines.forEach((l, i) => {
      const o = options[i][pick[i]];
      per[l.id] = o ? { vendorId: o.v, perBox: o.p } : null;
      if (o) { byVendor[o.v].lines++; byVendor[o.v].value += o.p * l.qty; total += o.p * l.qty; }
    });
    return { per, byVendor, total };
  };
  if (r.cap) {
    for (let it = 0; it < 200; it++) {
      const t = tally();
      const over = ids.find((v) => t.byVendor[v].value > r.cap! * t.total);
      if (!over) break;
      let best: { i: number; cost: number } | null = null;
      ev.lines.forEach((l, i) => {
        const k = pick[i];
        if (options[i][k]?.v !== over || !options[i][k + 1] || fixed.has(l.id)) return;
        const cost = (options[i][k + 1].p - options[i][k].p) * l.qty;
        if (!best || cost < best.cost) best = { i, cost };
      });
      if (!best) break;
      pick[(best as { i: number }).i]++;
      moved++;
    }
  }
  const award = tally();
  const base = solve(ev, grid.cells, grid.vendors.map((v) => v.id), asQuotedPrice);
  const changed = ev.lines
    .filter((l) => award.per[l.id]?.vendorId !== base.per[l.id]?.vendorId)
    .map((l) => {
      const a = award.per[l.id], b = base.per[l.id];
      const delta = (a?.perBox ?? 0) - (b?.perBox ?? 0);
      return { lineId: l.id, from: b?.vendorId ?? null, to: a?.vendorId ?? null, delta, deltaValue: delta * l.qty };
    });

  const rules = ["Basis unchanged: per box, ₹, delivered Chakan, GST extra."];
  if (r.eligible === "quality_cleared") rules.push("Eligible: questionnaire returned, valid ISO 9001, test report within 12 months.");
  for (const x of r.exclude ?? []) rules.push(`${name(x.vendorId)} left out: ${x.reason}.`);
  rules.push(fixed.size ? `Lines fixed by you: ${[...fixed].map(([l, v]) => `${l} to ${name(v)}`).join(", ")}; every other line goes to the lowest eligible price.` : "Each line goes to the lowest eligible price.");
  if (r.worstCase) rules.push("Open doubts priced against us: no conditional discounts, last year’s freight where freight is unknown, substitutes and suspect prices cannot win.");
  else {
    rules.push(r.assumeDiscounts ? "Conditional discounts assumed to apply." : "Conditional discounts not applied.");
    if (freight === "last_year") rules.push("Unknown freight taken at last year’s rate.");
    rules.push(r.acceptHeld ? "Substitute specs and prices far below should-cost allowed to win as quoted." : "Substitute specs and prices far below should-cost held out until confirmed.");
  }
  if (r.cap) rules.push(`No vendor above ${Math.round(r.cap * 100)}% of award value; lines move to the next-cheapest eligible vendor, cheapest moves first.`);

  const notes: string[] = [];
  const winners = new Set(Object.values(award.per).filter(Boolean).map((w) => w!.vendorId));
  for (const v of grid.vendors) {
    if (!winners.has(v.id)) continue;
    const any = ev.lines.find((l) => award.per[l.id]?.vendorId === v.id && grid.cells[cellKey(v.id, l.id)].norm.variants.conditionalDiscount);
    if (any && !r.assumeDiscounts) notes.push(`${v.short} wins ${award.byVendor[v.id].lines} lines without its conditional discount; if it applies, more could move to ${v.short}.`);
    if (ev.lines.some((l) => award.per[l.id]?.vendorId === v.id && grid.cells[cellKey(v.id, l.id)].norm.variants.lastYearFreight) && freight === "as_read")
      notes.push(`${v.short}’s winning prices are before freight, which it has not stated.`);
  }
  return { rules, excluded, award, base, changed, moved, notes };
}
