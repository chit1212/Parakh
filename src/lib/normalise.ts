// Milestone 2: every quoted price onto one basis (INR per box, delivered to the plant, ex-GST).
// Code only, never the model (L10). Each cell keeps the value as written next to the converted
// one (L9) and the calculation as a readable string. Nothing is guessed (L12): a unit, currency
// or charge code cannot settle leaves the cell unpriced with the reason, for the buyer to decide.
import { USD_REFERENCE } from "./config";
import { round } from "./geometry";
import type { Sheet } from "./files/xlsx";
import type { ReplyReading } from "./reader/pipeline";
import type { RfqLine, SourceRef, SourcingEvent, Verification } from "./types";

type Price = ReplyReading["prices"][number];
type Rule = ReplyReading["rateRules"][number];
type Term = ReplyReading["terms"][number];

export interface Variant {
  value: number;
  calc: string;
  /** Plain words: what has to be true for this value to hold. */
  when: string;
}

export interface NormCell {
  vendorId: string;
  lineId: string;
  /** priced: on the basis; not_quoted: the vendor does not price it; unclear: read, but code could not convert it safely. */
  status: "priced" | "not_quoted" | "unclear";
  /** The price as the vendor wrote it, e.g. "Rs 446.00 per 100 pcs, ex-works" or "Rs 44/kg (last year's rate)". */
  asWritten: string;
  source: SourceRef | null;
  verification: Verification | null;
  /** INR per box, delivered, ex-GST. Null unless status is priced. */
  perBox: number | null;
  /** How perBox was reached, e.g. "446.00 / 100 + 0.40 freight x 1.15 handling". */
  calc: string | null;
  /** A rate taken from last year's quote because the reply points to it (L8, L20). */
  lastYear: boolean;
  /** Values that hold only under a condition; never applied to perBox. */
  variants: { conditionalDiscount?: Variant; lastYearFreight?: Variant };
  /** Other readings of a doubtful number, converted the same way, so a doubt can be re-solved. */
  alternatives: { value: number; perBox: number; reason: string }[];
  /** The vendor offers a different spec from the one asked for. */
  alternate: string | null;
  /** Plain-English notes for the buyer, e.g. "quoted in USD". */
  flags: string[];
  /** Which reply this came from (a revision supersedes the earlier offer). */
  replyId: string;
}

export interface VendorBasis {
  vendorId: string;
  replyIds: string[];
  /** INR per box added for delivery, or null if the price is delivered or the amount is unknown. */
  freight: { perBox: number; calc: string; source: SourceRef } | null;
  freightUnknown: boolean;
  cells: NormCell[];
}

const fmt = (n: number, dp = 2) => n.toFixed(dp);
const ok = (v: Verification | null | undefined) => v?.status !== "failed";

/** Words of a unit, as a buyer would say them. */
const UNIT_WORDS: Record<string, string> = {
  per_box: "/box", per_piece: "/pc", per_100: " per 100 pcs", per_1000: " per 1,000 pcs", per_dozen: " per dozen",
  per_kg: "/kg", lump_sum: " lump sum", unclear: " (unit unclear)",
};
const money = (cur: string, text: string) => (cur === "USD" ? `USD ${text}` : cur === "INR" ? `Rs ${text}` : `${text} (currency not stated)`);

/** Last year's freight for a vendor, from the buyer's record of that vendor's earlier quote. */
export function lastYearFreight(sheets: Sheet[], vendorName: string): { perBox: number; where: string } | null {
  const key = vendorName.toLowerCase().split(" ").slice(0, 2).join(" ");
  const sheet = sheets.find((s) => s.name.toLowerCase().includes(key.split(" ")[0]) && /quote/i.test(s.name));
  if (!sheet) return null;
  const label = sheet.cells.find((c) => /^freight$/i.test(c.text.trim()));
  if (!label) return null;
  const val = sheet.cells.find((c) => c.row === label.row && c.col > label.col);
  const m = val?.text.match(/(\d+(?:\.\d+)?)\s*(?:per|\/)\s*box/i);
  return m ? { perBox: Number(m[1]), where: `sheet ${sheet.name}, cell ${val!.ref}` } : null;
}

/** Freight and handling for one vendor, from its checked terms. */
function freightOf(terms: Term[]): { add: VendorBasis["freight"]; unknown: boolean; notes: string[] } {
  const notes: string[] = [];
  const freight = terms.filter((t) => t.kind === "freight" && ok(t.verification));
  const stated = freight.find((t) => t.amount_stated && t.value !== null && !t.condition && (t.value_unit === "inr_per_box" || t.value_unit === "usd_per_box"));
  if (!stated) return { add: null, unknown: freight.some((t) => !t.amount_stated), notes };
  let perBox = stated.value_unit === "usd_per_box" ? stated.value! * USD_REFERENCE.rate : stated.value!;
  let calc = stated.value_unit === "usd_per_box" ? `${fmt(stated.value!, 4)} freight x ${USD_REFERENCE.rate}` : `${fmt(stated.value!)} freight`;
  const handling = terms.find(
    (t) => t.kind === "handling" && ok(t.verification) && t.value !== null && t.value_unit === "percent" && /freight|transport/i.test(`${t.applies_to} ${t.summary}`),
  );
  if (handling) {
    perBox *= 1 + handling.value! / 100;
    calc += ` x ${fmt(1 + handling.value! / 100)} (${handling.value}% handling)`;
  }
  const otherHandling = terms.filter((t) => t.kind === "handling" && t !== handling && ok(t.verification));
  for (const h of otherHandling) notes.push(`Handling charge not applied, because what it applies to is unclear: "${h.summary}"`);
  return { add: { perBox, calc, source: stated.source }, unknown: false, notes };
}

/** The vendor's conditional discount, kept separate (never applied to the main value). */
function conditionalDiscount(terms: Term[]): Term | null {
  return terms.find((t) => t.kind === "discount" && ok(t.verification) && t.value !== null && t.value_unit === "percent" && Boolean(t.condition)) ?? null;
}

/** One price converted to INR per box, ex-freight. Null with a reason when code cannot do it safely. */
function toPerBox(value: number, unit: string, currency: string, line: RfqLine): { v: number; calc: string } | { reason: string } {
  let v: number;
  let calc: string;
  switch (unit) {
    case "per_box":
    case "per_piece":
      v = value; calc = fmt(value, value < 1 ? 4 : 2); break;
    case "per_100":
      v = value / 100; calc = `${fmt(value)} / 100`; break;
    case "per_1000":
      v = value / 1000; calc = `${fmt(value)} / 1,000`; break;
    case "per_dozen":
      v = value / 12; calc = `${fmt(value)} / 12`; break;
    case "per_kg":
      v = line.weightKg * value; calc = `${fmt(line.weightKg, 3)} kg x ${value}`; break;
    default:
      return { reason: `The unit is ${unit === "lump_sum" ? "a lump sum" : "unclear"}, so it cannot be put on a per-box basis without guessing.` };
  }
  if (currency === "USD") {
    v *= USD_REFERENCE.rate; calc = `${calc} x ${USD_REFERENCE.rate}`;
  } else if (currency !== "INR") {
    return { reason: "No currency is stated, so it is not converted." };
  }
  return { v, calc };
}

/** The latest reply per vendor wins; earlier offers are kept only to show what a revision changed. */
function byVendor(readings: ReplyReading[]): Map<string, ReplyReading[]> {
  const m = new Map<string, ReplyReading[]>();
  for (const r of readings) {
    if (!r.vendorId || (r.status !== "read" && r.status !== "incomplete")) continue;
    m.set(r.vendorId, [...(m.get(r.vendorId) ?? []), r]);
  }
  for (const list of m.values()) list.sort((a, b) => Number(Boolean(b.revision?.is_revision)) - Number(Boolean(a.revision?.is_revision)));
  return m;
}

export function normalise(ev: SourcingEvent, readings: ReplyReading[], history: { sheets: Sheet[] }): VendorBasis[] {
  const out: VendorBasis[] = [];
  for (const [vendorId, list] of byVendor(readings)) {
    const latest = list[0];
    const earlier = list.slice(1);
    const vendor = ev.vendors.find((v) => v.id === vendorId);
    // Terms: the latest reply's, plus any kind it does not restate from an earlier offer.
    const kinds = new Set(latest.terms.map((t) => t.kind));
    const terms = [...latest.terms, ...earlier.flatMap((r) => r.terms.filter((t) => !kinds.has(t.kind)))];
    const fr = freightOf(terms);
    const disc = conditionalDiscount(terms);
    const lyFreight = fr.unknown && vendor ? lastYearFreight(history.sheets, vendor.name) : null;
    const held = latest.status === "incomplete";

    const cells: NormCell[] = ev.lines.map((line) => {
      const cell: NormCell = {
        vendorId, lineId: line.id, status: "unclear", asWritten: "", source: null, verification: null, perBox: null, calc: null,
        lastYear: false, variants: {}, alternatives: [], alternate: null, flags: [], replyId: latest.replyId,
      };
      if (held) cell.flags.push("This reply looks incomplete; held out of the comparison until the buyer decides.");
      const price: Price | undefined = latest.prices.find((p) => p.line_id === line.id && ok(p.verification));
      const rate: Rule | undefined = latest.rateRules.find(
        (r) => r.component === "board_per_kg" && ok(r.verification) && (r.applies_to_ply === line.plyN || r.applies_to_ply === null),
      );

      let base: { v: number; calc: string } | null = null;
      let basis: string = "not_stated";
      if (price) {
        basis = price.price_basis;
        cell.asWritten = `${money(price.currency, price.raw_value_text)}${UNIT_WORDS[price.unit] ?? ""}${basis === "ex_works" ? ", ex-works" : basis === "delivered" ? ", delivered" : ""}`;
        cell.source = price.source;
        cell.verification = price.verification;
        const r = toPerBox(price.raw_value, price.unit, price.currency, line);
        if ("reason" in r) cell.flags.push(r.reason);
        else base = r;
        if (price.unit === "per_100" || price.unit === "per_1000" || price.unit === "per_dozen") cell.flags.push(`priced${UNIT_WORDS[price.unit]}`);
        if (price.unit === "per_kg") cell.flags.push("priced per kg; box weight computed from the RFQ spec");
        if (price.currency === "USD") cell.flags.push(`quoted in USD; converted at Rs ${USD_REFERENCE.rate} (reference rate, ${USD_REFERENCE.date}); the vendor invoices at the invoice-date rate`);
        if (price.differs_from_rfq) cell.alternate = price.difference ?? `offered ${price.offered_spec ?? "a different spec"}`;
        for (const a of price.alternative_readings) {
          const ar = toPerBox(a.value, price.unit, price.currency, line);
          if (!("reason" in ar)) cell.alternatives.push({ value: a.value, perBox: ar.v, reason: a.reason });
        }
        // A revision: show what changed against the earlier offer.
        for (const e of earlier) {
          const was = e.prices.find((p) => p.line_id === line.id && ok(p.verification));
          if (was && was.raw_value !== price.raw_value) cell.flags.push(`revised (was ${was.raw_value_text} in the earlier offer)`);
        }
      } else if (rate) {
        // Priced by rate: weight from the RFQ spec x rate per kg, plus printing and die-cutting rates.
        cell.asWritten = `${money(rate.currency, rate.value_text)}/kg${rate.from_earlier_record ? " (last year's rate)" : ""}`;
        cell.source = rate.source;
        cell.verification = rate.verification;
        cell.lastYear = rate.from_earlier_record;
        cell.flags.push("priced per kg; box weight computed from the RFQ spec");
        if (rate.from_earlier_record) cell.flags.push(`${line.plyN}-ply rate taken from last year's quote ("${rate.pointer ?? "same as last year"}")`);
        const r = toPerBox(rate.value, "per_kg", rate.currency, line);
        if ("reason" in r) cell.flags.push(r.reason);
        else {
          base = r;
          const extra = (component: Rule["component"]) => latest.rateRules.find((x) => x.component === component && ok(x.verification));
          const print = extra("printing_per_colour");
          const die = extra("die_cutting_per_piece");
          if (line.colours > 0) {
            if (!print) { base = null; cell.flags.push(`Printing (${line.colours} colour) is not priced, so the box price is incomplete.`); }
            else {
              base.v += line.colours * print.value; base.calc += ` + ${fmt(line.colours * print.value)} print`;
              if (print.from_earlier_record) cell.lastYear = true;
            }
          }
          if (base && line.dieCut) {
            if (!die) { base = null; cell.flags.push("Die-cutting is not priced, so the box price is incomplete."); }
            else { base.v += die.value; base.calc += ` + ${fmt(die.value)} die-cutting`; }
          }
          if (base && (print?.from_earlier_record || die?.from_earlier_record)) cell.flags.push("printing and die-cutting at last year's rates");
        }
      } else {
        const nq = latest.notQuoted.find((n) => n.line_id === line.id);
        cell.status = "not_quoted";
        cell.asWritten = "not quoted";
        cell.source = nq?.source ?? null;
        cell.flags.push(nq?.stated_by_vendor ? `not quoted: ${nq.reason}` : "not in the reply");
        return cell;
      }
      if (!base) return cell;

      // Delivery: add freight to an ex-works or rate-based price; never guess an unknown amount.
      const delivered = basis === "delivered";
      if (!delivered && fr.add) {
        base.v += fr.add.perBox; base.calc += ` + ${fr.add.calc}`;
        cell.flags.push(`ex-works; freight added from ${where(fr.add.source)}`);
      } else if (!delivered && fr.unknown) {
        cell.flags.push(`freight extra, amount not given${lyFreight ? ` (last year it was Rs ${fmt(lyFreight.perBox)}/box)` : ""}`);
        if (lyFreight)
          cell.variants.lastYearFreight = {
            value: round(base.v + lyFreight.perBox, 2), calc: `${base.calc} + ${fmt(lyFreight.perBox)} freight (last year's)`,
            when: `if freight is the same as last year (Rs ${fmt(lyFreight.perBox)}/box, ${lyFreight.where})`,
          };
      } else if (!delivered && basis === "not_stated" && !fr.add) {
        cell.flags.push("The reply does not say whether prices include delivery; no freight added.");
      }
      cell.flags.push(...fr.notes);
      if (cell.alternatives.length && fr.add && !delivered) for (const a of cell.alternatives) a.perBox += fr.add.perBox;
      for (const a of cell.alternatives) a.perBox = round(a.perBox, 2);

      cell.status = "priced";
      cell.perBox = round(base.v, 2);
      cell.calc = base.calc === fmt(base.v, 2) ? "as written" : base.calc;
      if (disc)
        cell.variants.conditionalDiscount = {
          // Taken off the rounded per-box price, so the buyer can check it by hand.
          value: round(cell.perBox * (1 - disc.value! / 100), 2), calc: `${fmt(cell.perBox)} less ${disc.value}%`,
          when: `if ${disc.condition}`,
        };
      return cell;
    });
    out.push({ vendorId, replyIds: list.map((r) => r.replyId), freight: fr.add, freightUnknown: fr.unknown, cells });
  }
  return out;
}

function where(s: SourceRef): string {
  return [s.file, s.sheet && `sheet ${s.sheet}`, s.cell && `cell ${s.cell}`, s.page && `page ${s.page}`].filter(Boolean).join(", ");
}
