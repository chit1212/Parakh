// The comparison grid: every line by every vendor on one basis, with each cell's state, the
// lowest eligible price per line, and award value per vendor. Code only; the model never ranks.
import { SHOULD_COST } from "./config";
import type { Sheet } from "./files/xlsx";
import { normalise, type NormCell, type VendorBasis } from "./normalise";
import type { ReplyReading } from "./reader/pipeline";
import type { RfqLine, SourcingEvent } from "./types";

/** How a price is shown (design: "How to read a price"). */
export type CellKind =
  | "checked" // as written, passed the code checks
  | "converted" // a sum lies under it
  | "last_year" // a rate taken from last year's quote
  | "not_quoted"
  | "unclear"; // read, but code could not put it on the basis without guessing

export interface GridCell {
  vendorId: string;
  lineId: string;
  kind: CellKind;
  perBox: number | null;
  /** Price against should-cost, e.g. -0.25 for 25% below. */
  deviation: number | null;
  /** Outside the should-cost band (±12%): "high" (↑) or "low" (↓). */
  band: "high" | "low" | null;
  /** Can this price win the line as quoted? If not, why (for the buyer). */
  canWin: boolean;
  whyNot: string | null;
  norm: NormCell;
}

export interface GridVendor {
  id: string;
  name: string;
  short: string;
  /** "Excel", "PDF", "Word", "Photo", "Email". */
  format: string;
  fileName: string | null;
  /** One short note under the column head, e.g. "USD @ ₹88.20" or "27 of 30 quoted". */
  note: string;
  questionnaire: { returned: boolean; answers: number };
  basis: VendorBasis | null;
}

export interface Award {
  /** Winner per line, or null if nobody can win it. */
  per: Record<string, { vendorId: string; perBox: number } | null>;
  byVendor: Record<string, { lines: number; value: number }>;
  total: number;
}

export interface Grid {
  vendors: GridVendor[];
  lines: RfqLine[];
  cells: Record<string, GridCell>; // key `${vendorId}|${lineId}`
  asQuoted: Award;
  /** Number of questions in the RFQ questionnaire. */
  questions: number;
}

export const cellKey = (vendorId: string, lineId: string) => `${vendorId}|${lineId}`;

const FORMAT: Record<string, string> = { xlsx: "Excel", pdf: "PDF", docx: "Word", image: "Photo", eml: "Email", text: "Text" };

function kindOf(n: NormCell): CellKind {
  if (n.status === "not_quoted") return "not_quoted";
  if (n.status === "unclear") return "unclear";
  if (n.lastYear) return "last_year";
  return n.calc && n.calc !== "as written" ? "converted" : "checked";
}

/** Who wins each line among the given cells: lowest price that is allowed to win. */
export function solve(ev: SourcingEvent, cells: Record<string, GridCell>, vendorIds: string[], price: (c: GridCell) => number | null = (c) => c.perBox): Award {
  const per: Award["per"] = {};
  const byVendor: Award["byVendor"] = Object.fromEntries(vendorIds.map((v) => [v, { lines: 0, value: 0 }]));
  let total = 0;
  for (const l of ev.lines) {
    let best: { vendorId: string; perBox: number } | null = null;
    for (const v of vendorIds) {
      const c = cells[cellKey(v, l.id)];
      const p = c && c.canWin ? price(c) : null;
      if (p != null && (!best || p < best.perBox)) best = { vendorId: v, perBox: p };
    }
    per[l.id] = best;
    if (best) {
      byVendor[best.vendorId].lines++;
      byVendor[best.vendorId].value += best.perBox * l.qty;
      total += best.perBox * l.qty;
    }
  }
  return { per, byVendor, total };
}

export function buildGrid(
  ev: SourcingEvent,
  readings: ReplyReading[],
  history: { sheets: Sheet[] },
  files: Record<string, { kind: string; name: string } | undefined>,
): Grid {
  const bases = normalise(ev, readings, history);
  const cells: Grid["cells"] = {};
  const vendors: GridVendor[] = ev.vendors.map((v) => {
    const basis = bases.find((b) => b.vendorId === v.id) ?? null;
    const latest = basis ? readings.find((r) => r.replyId === basis.replyIds[0]) : undefined;
    const f = latest ? files[latest.replyId] : undefined;
    for (const l of ev.lines) {
      const n: NormCell = basis?.cells.find((c) => c.lineId === l.id) ?? {
        vendorId: v.id, lineId: l.id, status: "not_quoted", asWritten: "no reply read", source: null, verification: null, perBox: null,
        calc: null, lastYear: false, variants: {}, alternatives: [], alternate: null, flags: ["No reply from this vendor has been read."], replyId: "",
        vendorWording: null, matchReason: null,
      };
      const deviation = n.perBox != null ? n.perBox / l.shouldCost - 1 : null;
      const band = deviation == null || Math.abs(deviation) <= SHOULD_COST.band ? null : deviation > 0 ? "high" : "low";
      // Who may win as quoted. A substitute spec, a price far below should-cost, or a reply that
      // looks incomplete waits for the buyer or the vendor; it is shown, but cannot win yet.
      let whyNot: string | null = null;
      if (n.perBox == null) whyNot = n.status === "not_quoted" ? "not quoted" : "not on the basis yet";
      else if (latest?.status === "incomplete") whyNot = "the reply looks incomplete; held until the buyer decides";
      else if (n.alternate) whyNot = `a different spec was offered (${n.alternate}); it can win only once the buyer accepts it`;
      else if (band === "low") whyNot = `${Math.round(-deviation! * 100)}% below should-cost; it can win only once the vendor confirms it`;
      cells[cellKey(v.id, l.id)] = { vendorId: v.id, lineId: l.id, kind: kindOf(n), perBox: n.perBox, deviation, band, canWin: whyNot === null, whyNot, norm: n };
    }
    const quoted = ev.lines.filter((l) => cells[cellKey(v.id, l.id)].perBox != null).length;
    const notes: string[] = [];
    const firstPriced = basis?.cells.find((c) => c.status === "priced");
    if (firstPriced?.flags.some((f) => f.startsWith("quoted in USD"))) notes.push("USD converted");
    if (basis?.freight) notes.push("ex-works + freight");
    if (basis?.cells.some((c) => /per 100/.test(c.asWritten))) notes.push("per 100 converted");
    if (basis?.cells.some((c) => c.asWritten.endsWith("/kg") || c.lastYear)) notes.push("per kg converted");
    if (basis?.freightUnknown) notes.push("freight not given");
    if (basis?.cells.some((c) => c.variants.conditionalDiscount)) notes.push("discount kept apart ‡");
    if (quoted < ev.lines.length) notes.push(basis ? `${quoted} of ${ev.lines.length} on the basis` : "no reply read");
    return {
      id: v.id, name: v.name, short: v.short,
      format: f ? FORMAT[f.kind] ?? f.kind : "—",
      fileName: f?.name ?? null,
      note: notes.join(" · "),
      questionnaire: { returned: Boolean(latest && (latest.questionnaire.length || readings.some((r) => r.vendorId === v.id && r.questionnaire.length))), answers: Math.max(0, ...readings.filter((r) => r.vendorId === v.id).map((r) => r.questionnaire.length)) },
      basis,
    };
  });
  const asQuoted = solve(ev, cells, ev.vendors.map((v) => v.id));
  return { vendors, lines: ev.lines, cells, asQuoted, questions: ev.questions.length };
}
