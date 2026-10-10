// L27: freeze for award. A snapshot copies every number and its source at decision time, so later
// readings or revisions never change it. The AI never decides: the buyer freezes, the VP approves.
import { cellKey, type Award, type Grid } from "./compare";
import type { Decision } from "./decisions";
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
  /** "Approved by you": who approved this price against the document, and when, as at freezing. */
  checked: { who: string; at: string } | null;
}

export interface AuditEntry { at: string; who: string; what: string; why: string }

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
  /** quality: the questionnaire result at freeze time, e.g. "90 · cleared" (absent on older snapshots). */
  byVendor: { vendor: string; lines: number; value: number; quality?: string; cleared?: boolean }[];
  /** Set when only some lines were exported (a filtered view). */
  partial?: string;
  decisions: { title: string; status: string }[];
  /** Every approval, decision and override behind the award: when, who, what, why. Oldest first. */
  audit?: AuditEntry[];
  frozenBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  /** When the buyer sent it to the VP for approval (stubbed: nothing leaves the app). */
  sentAt?: string | null;
}

const NUMBER = ["", "one", "two", "three", "four", "five"];

/** A time on the record, in India time, e.g. "10 Oct, 15:41". */
export const fmtAt = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });

export function freeze(o: {
  ev: SourcingEvent; grid: Grid; quality: Quality[]; report: DoubtReport; lastYear: LastYearLine[];
  scenario: { title: string; result: ScenarioResult } | null; decisions: Decision[]; overrides?: Override[];
  /** Buyer sign-offs, keyed "vendorId:lineId". */
  checks?: Record<string, { who: string; at: string }>;
  /** Only these lines (an exported view); all lines when absent. */
  only?: string[];
}): Snapshot {
  const { ev, grid } = o;
  const award: Award = o.scenario?.result.award ?? grid.asQuoted;
  const rows: SnapshotRow[] = ev.lines.filter((l) => !o.only || o.only.includes(l.id)).map((l) => {
    const w = award.per[l.id];
    const c = w ? grid.cells[cellKey(w.vendorId, l.id)] : null;
    return {
      lineId: l.id, name: l.name, qty: l.qty,
      vendorId: w?.vendorId ?? null, vendor: w ? grid.vendors.find((v) => v.id === w.vendorId)!.short : null,
      perBox: w?.perBox ?? null, value: w ? w.perBox * l.qty : 0,
      asWritten: c?.norm.asWritten ?? null, calc: c?.norm.calc ?? null, where: c?.norm.source ? where(c.norm.source) : null,
      replyId: c?.norm.replyId ?? null, source: c?.norm.source ?? null, raw: c?.norm.raw ?? null,
      checked: w ? o.checks?.[`${w.vendorId}:${l.id}`] ?? null : null,
    };
  });
  const byVendor = grid.vendors
    .map((v) => {
      const q = o.quality.find((x) => x.vendorId === v.id);
      return {
        vendor: v.short, lines: rows.filter((r) => r.vendorId === v.id).length, value: rows.filter((r) => r.vendorId === v.id).reduce((a, r) => a + r.value, 0),
        quality: !q?.returned ? "quality not returned" : `${q.score} · ${q.cleared ? "cleared" : "not cleared"}`, cleared: !!q?.cleared,
      };
    })
    .filter((v) => v.lines);
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
    rows, total: o.only ? rows.reduce((a, r) => a + r.value, 0) : award.total,
    cheapestOverall: o.only ? rows.reduce((a, r) => a + (grid.asQuoted.per[r.lineId]?.perBox ?? 0) * r.qty, 0) : grid.asQuoted.total,
    lastYear, byVendor, ...(o.only ? { partial: `${rows.length} of ${ev.lines.length} lines, as filtered` } : {}),
    decisions: [
      ...o.report.raised.map((d) => {
        const x = o.decisions.find((y) => y.title === d.title || (y.vendorId === d.vendorId && y.lineIds.join() === d.lineIds.join()));
        return { title: d.title, status: x ? `${x.choice} (${x.who}, ${fmtAt(x.at)})` : "Open: not yet answered" };
      }),
      // Decided doubts that no longer change a winner (e.g. an accepted price now competes).
      ...o.decisions.filter((x) => !o.report.raised.some((d) => d.title === x.title)).map((x) => ({ title: x.title, status: `${x.choice} (${x.who}, ${fmtAt(x.at)})` })),
      ...(o.overrides ?? []).map((x) => ({
        title: `Override: ${x.lineId} from ${grid.vendors.find((v) => v.id === x.from)?.short ?? "nobody"} to ${grid.vendors.find((v) => v.id === x.to)?.short ?? x.to}`,
        status: `${x.who}, ${fmtAt(x.at)}: ${x.why}`,
      })),
    ],
    audit: [
      ...Object.entries(o.checks ?? {}).map(([k, c]) => {
        const [vid, lid] = k.split(":");
        const cell = grid.cells[cellKey(vid, lid)];
        const v = grid.vendors.find((x) => x.id === vid)?.short ?? vid;
        const won = award.per[lid]?.vendorId === vid;
        return { at: c.at, who: c.who, what: `Approved ${v}'s price for ${lid}${cell?.perBox != null ? ` (₹${cell.perBox.toFixed(2)})` : ""}${won ? ", awarded" : ", not awarded in this view"}`, why: `Matches the source: ${cell?.norm.source ? where(cell.norm.source) : "as read"}` };
      }),
      ...o.decisions.map((x) => ({ at: x.at, who: x.who, what: `${x.title}: ${x.choice}`, why: x.why })),
      ...(o.overrides ?? []).map((x) => ({ at: x.at, who: x.who, what: `Override: ${x.lineId} from ${grid.vendors.find((v) => v.id === x.from)?.short ?? "nobody"} to ${grid.vendors.find((v) => v.id === x.to)?.short ?? x.to}`, why: x.why })),
    ].sort((a, b) => a.at.localeCompare(b.at)),
    frozenBy: ev.buyer, approvedBy: null, approvedAt: null,
  };
}

export const SNAPSHOT_KEY = "parakh.award.v1";
export const OVERRIDES_KEY = "parakh.overrides.v1";

/** L32: a buyer override, with its audit trail. */
export interface Override {
  lineId: string;
  /** Vendor id the line was going to, and the one the buyer chose ("" removes the override). */
  from: string | null;
  to: string;
  why: string;
  who: string;
  at: string;
}
