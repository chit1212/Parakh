// L27: freeze for award. A snapshot copies every number and its source at decision time, so later
// readings or revisions never change it. The AI never decides: the buyer freezes, the VP approves.
import { cellKey, type Award, type Grid } from "./compare";
import type { DoubtReport } from "./doubts";
import { hashOfText, where } from "./format";
import type { Quality } from "./quality";
import type { ScenarioResult } from "./scenario";
import type { LastYearLine, SourceRef, SourcingEvent } from "./types";

export interface SnapshotRow {
  lineId: string;
  name: string;
  qty: number;
  vendorId: string | null;
  vendor: string | null;
  perBox: number | null;
  value: number;
  asWritten: string | null;
  calc: string | null;
  where: string | null;
  /** For the trace panel: the reply and source the price was read from. */
  replyId: string | null;
  source: SourceRef | null;
  raw: { text: string; value: number } | null;
}

export interface Snapshot {
  id: string;
  frozenAt: string;
  eventId: string;
  title: string;
  /** Which view was frozen: "As quoted" or the scenario's title. */
  basis: string;
  rules: string[];
  excluded: { name: string; why: string }[];
  rows: SnapshotRow[];
  total: number;
  cheapestOverall: number;
  /** Like-for-like against last year, on the lines that have a price from last year. */
  lastYear: { lines: number; thisYear: number; lastYear: number } | null;
  byVendor: { vendor: string; lines: number; value: number }[];
  decisions: { title: string; status: string }[];
  frozenBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

const NUMBER = ["", "one", "two", "three", "four", "five"];

export function freeze(o: {
  ev: SourcingEvent; grid: Grid; quality: Quality[]; report: DoubtReport; lastYear: LastYearLine[];
  scenario: { title: string; result: ScenarioResult } | null; decisions: Record<string, string>;
}): Snapshot {
  const { ev, grid } = o;
  const award: Award = o.scenario?.result.award ?? grid.asQuoted;
  const rows: SnapshotRow[] = ev.lines.map((l) => {
    const w = award.per[l.id];
    const c = w ? grid.cells[cellKey(w.vendorId, l.id)] : null;
    return {
      lineId: l.id, name: l.name, qty: l.qty,
      vendorId: w?.vendorId ?? null, vendor: w ? grid.vendors.find((v) => v.id === w.vendorId)!.short : null,
      perBox: w?.perBox ?? null, value: w ? w.perBox * l.qty : 0,
      asWritten: c?.norm.asWritten ?? null, calc: c?.norm.calc ?? null, where: c?.norm.source ? where(c.norm.source) : null,
      replyId: c?.norm.replyId ?? null, source: c?.norm.source ?? null, raw: c?.norm.raw ?? null,
    };
  });
  const byVendor = grid.vendors.filter((v) => award.byVendor[v.id]?.lines).map((v) => ({ vendor: v.short, lines: award.byVendor[v.id].lines, value: award.byVendor[v.id].value }));
  const ly = rows.filter((r) => r.perBox != null && o.lastYear.some((x) => x.lineId === r.lineId));
  const lastYear = ly.length
    ? { lines: ly.length, thisYear: ly.reduce((a, r) => a + r.value, 0), lastYear: ly.reduce((a, r) => a + o.lastYear.find((x) => x.lineId === r.lineId)!.price * r.qty, 0) }
    : null;
  const cleared = o.scenario?.result.rules.some((r) => r.startsWith("Eligible:"));
  const n = byVendor.length;
  const title = n === 1 ? `Award to ${byVendor[0].vendor}` : `Split award to ${NUMBER[n] ?? n}${cleared ? " quality-cleared" : ""} vendors`;
  const frozenAt = new Date().toISOString();
  return {
    id: hashOfText(JSON.stringify(rows) + frozenAt).slice(0, 6),
    frozenAt, eventId: ev.id, title,
    basis: o.scenario?.title ?? "As quoted (cheapest per line, all vendors)",
    rules: o.scenario?.result.rules ?? ["Each line goes to the lowest price that can win as quoted."],
    excluded: (o.scenario?.result.excluded ?? []).map((x) => ({ name: x.name, why: x.why })),
    rows, total: award.total, cheapestOverall: grid.asQuoted.total, lastYear, byVendor,
    decisions: o.report.raised.map((d) => ({ title: d.title, status: o.decisions[d.title] ?? "Open: not yet answered" })),
    frozenBy: ev.buyer, approvedBy: null, approvedAt: null,
  };
}

export const SNAPSHOT_KEY = "parakh.award.v1";
