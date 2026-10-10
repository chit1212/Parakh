// One fact store for the table, the charts and the chat (review fix 1.1). Every figure the analyst
// quotes comes from these functions over the same grid and scenario the Compare screen shows; the
// model is never handed a separately built summary.
import type { Award, Grid } from "./compare";
import type { LastYearLine, SourcingEvent } from "./types";

export interface YoyDriver { lineId: string; name: string; vendorId: string; lyPrice: number; price: number; qty: number; amount: number }

/**
 * Year-on-year drivers: for every line with last year's price and a winner in this award,
 * (winning price − last year's price) × quantity, largest increase first.
 */
export function yoyDrivers(ev: SourcingEvent, award: Award, lastYear: LastYearLine[], n = 5) {
  const all: YoyDriver[] = [];
  for (const l of ev.lines) {
    const w = award.per[l.id], ly = lastYear.find((x) => x.lineId === l.id);
    if (!w || !ly) continue;
    all.push({ lineId: l.id, name: l.name, vendorId: w.vendorId, lyPrice: ly.price, price: w.perBox, qty: l.qty, amount: (w.perBox - ly.price) * l.qty });
  }
  all.sort((a, b) => b.amount - a.amount);
  const thisYear = all.reduce((a, d) => a + d.price * d.qty, 0), lastYearTotal = all.reduce((a, d) => a + d.lyPrice * d.qty, 0);
  return { top: all.slice(0, n), comparableLines: all.length, net: thisYear - lastYearTotal, thisYear, lastYear: lastYearTotal };
}

/** Each vendor's share of an award: value, %, lines. */
export function shares(grid: Grid, award: Award) {
  return grid.vendors.map((v) => ({ vendorId: v.id, name: v.short, lines: award.byVendor[v.id].lines, value: award.byVendor[v.id].value, pct: award.total ? award.byVendor[v.id].value / award.total : 0 }))
    .filter((s) => s.lines).sort((a, b) => b.value - a.value);
}
