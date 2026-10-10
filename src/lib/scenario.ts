// L25: what-if scenarios, solved in code. The analyst chat chooses the rules; this does every sum.
import { asQuotedPrice, cellKey, solve, type Award, type Grid, type GridCell, type PriceRule } from "./compare";
import { crore, lakh } from "./format";
import type { Quality } from "./quality";
import type { SourcingEvent } from "./types";
import { allocate, type AllocStatus } from "./allocate";

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
  /** Award to at most this many vendors: every set of that size that covers every line is tried; the lowest total wins. */
  maxVendors?: number | null;
  /** Lines fixed to a vendor by the buyer. */
  overrides?: { lineId: string; vendorId: string }[];
  /** "Find cheaper": give the exact solver longer before it settles for "not proven". */
  solveMs?: number;
}

export interface ScenarioResult {
  rules: string[];
  excluded: { vendorId: string; name: string; why: string }[];
  award: Award;
  base: Award;
  changed: { lineId: string; from: string | null; to: string | null; delta: number; deltaValue: number }[];
  /** Lines moved by the cap, if any. */
  moved: number;
  /** With a vendor limit: the best sets tried, cheapest first, and how many were tried. */
  sets?: { vendors: string[]; total: number; covers: number }[];
  tried?: number;
  /** Doubts that still matter under these rules, in words. */
  notes: string[];
  /** Whether the allocation is proven cheapest under the rules (exact solver + independent single-move check). */
  status: AllocStatus;
  selfCheck: { passed: boolean; move?: string };
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
  const allEligible = [...ids];

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
  function withOverridesFor(v: string, lineId: string) { const c = grid.cells[cellKey(v, lineId)]; return c ? withOverrides(c) : null; }

  // A vendor limit: try every set of that many eligible vendors; prefer sets that cover every line,
  // then the lowest total (each line to the cheaper vendor in the set). Code only.
  let sets: ScenarioResult["sets"];
  let tried: number | undefined;
  if (r.maxVendors && r.maxVendors < ids.length) {
    const k = Math.max(1, Math.floor(r.maxVendors));
    const combos: string[][] = [];
    const pickSet = (start: number, acc: string[]) => {
      if (acc.length === k) { combos.push(acc); return; }
      for (let i = start; i < ids.length; i++) pickSet(i + 1, [...acc, ids[i]]);
    };
    pickSet(0, []);
    tried = combos.length;
    sets = combos.map((vs) => {
      let total = 0, covers = 0;
      for (const l of ev.lines) {
        const ps = vs.map((v) => withOverridesFor(v, l.id)).filter((p): p is number => p != null);
        if (ps.length) { covers++; total += Math.min(...ps) * l.qty; }
      }
      return { vendors: vs, total, covers };
    }).sort((a, b) => b.covers - a.covers || a.total - b.total);
    const best = sets[0];
    if (best) for (const v of [...ids]) if (!best.vendors.includes(v)) ids.splice(ids.indexOf(v), 1);
  }
  // Each line to its cheapest eligible vendor; with a share cap, an exact integer program instead
  // (jointly with any vendor limit), then an independent check that no single move is cheaper.
  const optionsFor = (vs: string[]) => ev.lines.map((l) =>
    vs.map((v) => ({ v, p: withOverrides(grid.cells[cellKey(v, l.id)]) })).filter((o): o is { v: string; p: number } => o.p != null).sort((a, b) => a.p - b.p),
  );
  const capVs = r.cap ? allEligible : ids;
  const options = optionsFor(capVs);
  let alloc = allocate(ev.lines.map((l, i) => ({ lineId: l.id, qty: l.qty, options: options[i] })), r.cap ?? null, r.cap && r.maxVendors ? Math.floor(r.maxVendors) : null, r.solveMs);
  // A cap that cannot be met: keep the other rules (e.g. the vendor limit) and say the cap is not applied.
  if (alloc.status === "infeasible" && r.cap) {
    const rest = optionsFor(ids);
    alloc = { ...allocate(ev.lines.map((l, i) => ({ lineId: l.id, qty: l.qty, options: rest[i] })), null, null), status: "infeasible", selfCheck: alloc.selfCheck };
  }
  const base0 = optionsFor(capVs).map((o) => o[0]?.v);
  const moved = r.cap ? ev.lines.filter((l, i) => alloc.pick[l.id] && alloc.pick[l.id]!.v !== base0[i]).length : 0;
  const tally = (): Award => {
    const per: Award["per"] = {};
    const byVendor: Award["byVendor"] = Object.fromEntries(grid.vendors.map((v) => [v.id, { lines: 0, value: 0 }]));
    let total = 0;
    ev.lines.forEach((l) => {
      const o = alloc.pick[l.id];
      per[l.id] = o ? { vendorId: o.v, perBox: o.p } : null;
      if (o) { byVendor[o.v].lines++; byVendor[o.v].value += o.p * l.qty; total += o.p * l.qty; }
    });
    return { per, byVendor, total };
  };
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
  if (sets?.length) {
    const k = sets[0].vendors.length, full = sets.filter((x) => x.covers === ev.lines.length);
    const show = (x: { vendors: string[]; total: number; covers: number }) => `${x.vendors.map(name).join(" + ")} ${x.covers === ev.lines.length ? crore(x.total) : `covers ${x.covers} of ${ev.lines.length} lines`}`;
    rules.push(k === 1
      ? `One vendor for everything: ${full.length ? `${full.length} of ${tried} eligible vendors can take every line; lowest total wins` : `no eligible vendor can take every line, so the one covering most lines wins`}. ${sets.map(show).join(" · ")}.`
      : `${k} vendors only: ${tried} sets of eligible vendors tried, ${full.length} cover every line; lowest total wins. Best: ${sets.slice(0, 3).map(show).join(" · ")}.`);
  } else if (r.maxVendors && r.maxVendors >= allEligible.length) rules.push(`At most ${r.maxVendors} vendors: only ${allEligible.length} are eligible, so no limit applies.`);
  if (r.cap) rules.push(alloc.status === "infeasible"
    ? `No vendor above ${Math.round(r.cap * 100)}% of award value: this cannot be met with the eligible vendors, so the cap is not applied.`
    : `No vendor above ${Math.round(r.cap * 100)}% of award value; solved exactly (an integer program over every line and vendor), ${alloc.status === "proven_optimal" ? "proven cheapest" : "meets the cap but not proven cheapest"}.`);

  const notes: string[] = [];
  const winners = new Set(Object.values(award.per).filter(Boolean).map((w) => w!.vendorId));
  for (const v of grid.vendors) {
    if (!winners.has(v.id)) continue;
    const any = ev.lines.find((l) => award.per[l.id]?.vendorId === v.id && grid.cells[cellKey(v.id, l.id)].norm.variants.conditionalDiscount);
    if (any && !r.assumeDiscounts) notes.push(`${v.short} wins ${award.byVendor[v.id].lines} lines without its conditional discount; if it applies, more could move to ${v.short}.`);
    if (ev.lines.some((l) => award.per[l.id]?.vendorId === v.id && grid.cells[cellKey(v.id, l.id)].norm.variants.lastYearFreight) && freight === "as_read")
      notes.push(`${v.short}’s winning prices are before freight, which it has not stated.`);
  }
  if (sets?.length && sets[0].covers < ev.lines.length)
    notes.push(`No line can go to a vendor outside the chosen set: ${ev.lines.filter((l) => !award.per[l.id]).map((l) => l.id).join(", ")} ${sets[0].covers === ev.lines.length - 1 ? "is" : "are"} left unawarded.`);
  if (r.worstCase) {
    const asRead = runScenario(ev, grid, quality, { ...r, worstCase: false });
    const d = award.total - asRead.award.total;
    notes.unshift(Math.abs(d) < 1
      ? "Resolving every open doubt against us costs nothing more here: the doubts that remain are with vendors already left out, or already priced at their less favourable reading."
      : `Open doubts can cost up to ${lakh(d)} more than the same rules with doubts as read (${crore(asRead.award.total)}).`);
  }
  if (alloc.selfCheck.move) notes.push(`Self-check: ${alloc.selfCheck.move}.`);
  return { rules, excluded, award, base, changed, moved, notes, sets, tried, status: alloc.status, selfCheck: alloc.selfCheck };
}

/**
 * The scenario library (design: "Scenario" dropdown): general award strategies, always available,
 * each solved in code. Every one except "As quoted" applies the quality gate.
 */
export interface LibraryScenario { key: string; title: string; desc: string; rules: ScenarioRules }

export const LIBRARY: LibraryScenario[] = [
  { key: "base", title: "As quoted — cheapest per line, all vendors", desc: "Each line to its lowest price, doubts priced as read. The cheapest possible result; useful for comparison, rarely what you’d award.", rules: { eligible: "all" } },
  { key: "S1", title: "Cheapest per line, quality-cleared only", desc: "Each line to the lowest price among vendors who cleared the quality questionnaire.", rules: { eligible: "quality_cleared" } },
  { key: "S5", title: "Two vendors only, lowest total", desc: "Tries every pair of quality-cleared vendors that together cover every line; each line goes to the cheaper of the pair, and the pair with the lowest total wins.", rules: { eligible: "quality_cleared", maxVendors: 2 } },
  { key: "S4", title: "One vendor for everything, lowest total", desc: "Only quality-cleared vendors who can take every line qualify; the lowest total wins.", rules: { eligible: "quality_cleared", maxVendors: 1 } },
  { key: "S3", title: "Spread the risk, no vendor above 40%", desc: "Cheapest per line among quality-cleared vendors, then the cheapest-to-move lines leave any vendor above 40% of the award value.", rules: { eligible: "quality_cleared", cap: 0.4 } },
  { key: "S2", title: "Worst case on open doubts", desc: "Cheapest per line among quality-cleared vendors with every open doubt resolved against us: no conditional discounts, last year’s freight where freight is unknown, substitutes and suspect prices out. Shows the most the doubts can cost.", rules: { eligible: "quality_cleared", worstCase: true } },
];

/** Two rule sets ask the same thing (ignoring the title and empty fields). */
export function sameRules(a: ScenarioRules, b: ScenarioRules): boolean {
  const norm = (r: ScenarioRules) => JSON.stringify({
    eligible: r.eligible, exclude: (r.exclude ?? []).map((x) => x.vendorId).sort(), assumeDiscounts: !!r.assumeDiscounts,
    freight: r.freight ?? "as_read", acceptHeld: !!r.acceptHeld, worstCase: !!r.worstCase, cap: r.cap ?? null, maxVendors: r.maxVendors ?? null,
    overrides: (r.overrides ?? []).map((o) => `${o.lineId}:${o.vendorId}`).sort(),
  });
  return norm(a) === norm(b);
}

/** A short name for a scenario, from its rules, when the model's label is missing or is the question itself. */
export function describeRules(r: ScenarioRules, short: (v: string) => string): string {
  const parts: string[] = [r.eligible === "quality_cleared" ? "Quality-cleared" : "All vendors"];
  if (r.exclude?.length) parts.push(`without ${r.exclude.map((x) => short(x.vendorId)).join(" and ")}`);
  if (r.maxVendors) parts.push(`${r.maxVendors} vendor${r.maxVendors > 1 ? "s" : ""} only`);
  if (r.cap) parts.push(`max ${Math.round(r.cap * 100)}% per vendor`);
  if (r.worstCase) parts.push("doubts against us");
  if (r.assumeDiscounts) parts.push("discounts applied");
  if (r.freight === "last_year") parts.push("last year’s freight");
  if (r.acceptHeld) parts.push("held prices allowed");
  if (r.overrides?.length) parts.push(`${r.overrides.length} line${r.overrides.length > 1 ? "s" : ""} fixed`);
  return parts.join(", ");
}
export const goodTitle = (t: string) => !!t.trim() && t.trim().length <= 70 && !/\?\s*$/.test(t.trim()) && !/^(what|how|which|why|can|should|is|are|do|does)\b/i.test(t.trim());
