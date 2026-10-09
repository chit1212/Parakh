// The demo event: the RFQ lines and questionnaire come from the buyer's own template,
// last year's prices from the buyer's award record. Parsed in code.
import fs from "node:fs/promises";
import path from "node:path";
import { DATASET_DIR } from "./config";
import { readWorkbook, type Sheet } from "./files/xlsx";
import { costLine, parseSpec, rscBlankAreaM2 } from "./geometry";
import type { LastYearLine, Question, RfqLine, SourcingEvent } from "./types";

const RFQ_TEMPLATE = "01_rfq/SE-2026-041_Quote_Template.xlsx";
const HISTORY = "04_history/SE-2025-037_Award_Summary.xlsx";

export const datasetPath = (rel: string) => path.join(process.cwd(), DATASET_DIR, rel);

/** Header of the RFQ the buyer issued (01_rfq/SE-2026-041_RFQ_Corrugated_Boxes.pdf). */
const HEADER = {
  id: "SE-2026-041",
  title: "Corrugated boxes, FY27 H2",
  buyerCo: "Sahyadri Appliances Pvt. Ltd.",
  plant: "Plant 2, MIDC Chakan, Pune 410501",
  buyer: "Vikram Deshpande",
  buyerRole: "Category Buyer, Packaging",
  buyerEmail: "vikram.deshpande@sahyadri-appliances.example",
  vp: "Meera Kulkarni",
  vpRole: "VP, Procurement",
  issued: "22 Sep 2026",
  due: "03 Oct 2026",
  basis: "Price per box (or per piece for accessories), in INR, delivered to Plant 2 Chakan, GST extra",
  lyEventId: "SE-2025-037",
  passRule:
    "Questionnaire returned, score 70 or more, and both mandatory items (Q1 ISO 9001, Q2 test report within 12 months) passed",
  notes: [
    "Sizes are internal dimensions. All cartons are regular slotted cartons (RSC) unless stated.",
    "L21 is now 7-ply (it was 5-ply in SE-2025-037).",
    "L28 and L29 are new SKUs for the air fryer launch.",
    "Monthly PO value per vendor is expected to be between INR 15 and 30 lakh, depending on how the award is split.",
    "Freight, loading and any handling charges must be included in the delivered price or shown separately.",
  ],
  // The five vendors the RFQ went to (the buyer's distribution list).
  vendors: [
    { id: "SB", name: "Shree Balaji Corrugators", short: "Shree Balaji", city: "Bhosari MIDC, Pune", contact: "Sanjay Agarwal", email: "sanjay@shreebalaji-corr.example" },
    { id: "VP", name: "Vardhman Packwell Exports", short: "Vardhman", city: "Ranjangaon MIDC, Pune", contact: "Ritu Jain", email: "exports@vardhmanpackwell.example" },
    { id: "KP", name: "Kaveri Paper Products", short: "Kaveri", city: "Talegaon Dabhade, Pune", contact: "Prakash Kulkarni", email: "sales@kaveripaper.example" },
    { id: "AC", name: "Anand Cartons", short: "Anand", city: "Chakan, Pune", contact: "Anand Shinde", email: "anandcartons.chakan@example.com" },
    { id: "RB", name: "Rohit Box Industries", short: "Rohit Box", city: "Shikrapur, Pune", contact: "Rohit Gaikwad", email: "rohit.gaikwad@rohitbox.example" },
  ],
};

function buildLine(id: string, name: string, size: string, spec: string, qty: number): RfqLine {
  const s = parseSpec(spec);
  const dims = size.match(/(\d+)\s*x\s*(\d+)\s*x\s*(\d+)\s*mm/i);
  const board = size.match(/([\d.]+)\s*m2\s*board area/i);
  let areaM2: number;
  let dimsMm: RfqLine["dimsMm"] = null;
  if (dims) {
    dimsMm = { L: Number(dims[1]), W: Number(dims[2]), H: Number(dims[3]) };
    areaM2 = rscBlankAreaM2(dimsMm.L, dimsMm.W, dimsMm.H);
  } else if (board) areaM2 = Number(board[1]);
  else throw new Error(`Cannot read size for ${id}: ${size}`);
  const dieCut = /die-cut/i.test(name);
  const c = costLine({ areaM2, layersGsm: s.layersGsm, flutes: s.flutes, plyN: s.plyN, colours: s.colours, dieCut });
  return {
    id, name, size, spec, qty,
    kind: dims ? "RSC" : "ACC",
    dimsMm, ply: s.ply, plyN: s.plyN, flutes: s.flutes, layersGsm: s.layersGsm, colours: s.colours, dieCut,
    ...c,
  };
}

function linesFromTemplate(sheets: Sheet[]): { lines: RfqLine[]; questions: Question[] } {
  const tpl = sheets[0];
  const byRow = new Map<number, Record<number, string | number | boolean | null>>();
  for (const c of tpl.cells) byRow.set(c.row, { ...(byRow.get(c.row) ?? {}), [c.col]: c.value });
  const lines: RfqLine[] = [];
  for (const [, r] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    if (typeof r[1] === "string" && /^L\d{2}$/.test(r[1])) {
      lines.push(buildLine(r[1], String(r[2]), String(r[3]), String(r[4]), Number(r[5])));
    }
  }
  const qs = sheets.find((s) => /question/i.test(s.name));
  const questions: Question[] = [];
  if (qs) {
    const qRows = new Map<number, Record<number, string | number | boolean | null>>();
    for (const c of qs.cells) qRows.set(c.row, { ...(qRows.get(c.row) ?? {}), [c.col]: c.value });
    for (const [, r] of qRows) {
      if (typeof r[1] === "string" && /^Q\d+$/.test(r[1]))
        questions.push({ id: r[1], text: String(r[2]), type: r[3] === "Mandatory" ? "Mandatory" : "Scored" });
    }
  }
  return { lines, questions };
}

let cached: Promise<SourcingEvent> | null = null;

export function loadEvent(): Promise<SourcingEvent> {
  cached ??= (async () => {
    const sheets = await readWorkbook(await fs.readFile(datasetPath(RFQ_TEMPLATE)));
    const { lines, questions } = linesFromTemplate(sheets);
    return { ...HEADER, lines, questions };
  })();
  return cached;
}

export interface History {
  file: string;
  lines: LastYearLine[];
  /** Every sheet as parsed, so a vendor's earlier quote can be shown to the reader when its reply refers to it. */
  sheets: Sheet[];
}

let historyCache: Promise<History> | null = null;

export function loadHistory(): Promise<History> {
  historyCache ??= (async () => {
    const file = path.basename(HISTORY);
    const sheets = await readWorkbook(await fs.readFile(datasetPath(HISTORY)));
    const award = sheets.find((s) => /award/i.test(s.name)) ?? sheets[0];
    const rows = new Map<number, Map<number, { v: unknown; ref: string }>>();
    for (const c of award.cells) {
      if (!rows.has(c.row)) rows.set(c.row, new Map());
      rows.get(c.row)!.set(c.col, { v: c.value, ref: c.ref });
    }
    const lines: LastYearLine[] = [];
    for (const r of rows.values()) {
      const id = r.get(1)?.v;
      const price = r.get(5);
      if (typeof id === "string" && /^L\d{2}$/.test(id) && typeof price?.v === "number") {
        lines.push({
          lineId: id,
          board: String(r.get(3)?.v ?? ""),
          vendor: String(r.get(4)?.v ?? ""),
          price: price.v,
          source: { kind: "cell", file, sheet: award.name, cell: price.ref },
        });
      }
    }
    return { file, lines, sheets };
  })();
  return historyCache;
}
