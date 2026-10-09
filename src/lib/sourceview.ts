// L15: the original document, drawn for the source panel, with the place a value was read from
// highlighted. Code finds the place (the same matching the source check uses); the model is not asked.
import { getDocumentProxy } from "unpdf";
import type { Sheet } from "./files/xlsx";
import { contains, hasNumber, norm } from "./reader/verify";
import type { ReplyFile, SourceRef } from "./types";

export interface Expect {
  valueText?: string;
  value?: number;
}

export type SourceView =
  | { kind: "sheet"; file: string; sheet: string; sheets: string[]; cols: string[]; rows: { n: number; cells: string[] }[]; hit: { row: number; col: number } | null; merged: string[] }
  | { kind: "doc"; file: string; blocks: ({ type: "p"; text: string; hit: boolean } | { type: "table"; n: number; rows: { cells: string[]; hit: boolean; value?: number }[] })[] }
  | { kind: "email"; file: string; headers: [string, string][]; lines: { text: string; hit: boolean }[] }
  | { kind: "pdf"; file: string; page: number; pages: number; width: number; height: number; items: { str: string; x: number; y: number; w: number; h: number; hit: boolean; value?: boolean }[]; found: boolean }
  | { kind: "image"; file: string; path: string; region: SourceRef["region"] }
  | { kind: "none"; file: string; why: string };

const colName = (n: number) => {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

function sheetView(file: string, sheets: Sheet[], src: SourceRef): SourceView {
  const sheet = sheets.find((s) => s.name.toLowerCase() === (src.sheet ?? "").toLowerCase()) ?? sheets[0];
  if (!sheet) return { kind: "none", file, why: "The workbook has no sheets." };
  const hitCell = src.cell ? sheet.cells.find((c) => c.ref.toUpperCase() === src.cell!.toUpperCase()) : undefined;
  const maxCol = Math.max(1, ...sheet.cells.map((c) => c.col));
  const maxRow = Math.max(1, ...sheet.cells.map((c) => c.row));
  // A window of rows around the hit, so the panel stays readable on long sheets.
  const centre = hitCell?.row ?? 1;
  const from = Math.max(1, Math.min(centre - 7, maxRow - 15));
  const to = Math.min(maxRow, from + 15);
  const byRef = new Map(sheet.cells.map((c) => [`${c.row}:${c.col}`, c.text]));
  const rows = [];
  for (let r = from; r <= to; r++) rows.push({ n: r, cells: Array.from({ length: maxCol }, (_, i) => byRef.get(`${r}:${i + 1}`) ?? "") });
  return {
    kind: "sheet", file, sheet: sheet.name, sheets: sheets.map((s) => s.name), merged: sheet.merged,
    cols: Array.from({ length: maxCol }, (_, i) => colName(i + 1)), rows,
    hit: hitCell ? { row: hitCell.row, col: hitCell.col } : null,
  };
}

function docView(f: ReplyFile, src: SourceRef, ex: Expect, rowHint?: string): SourceView {
  const d = f.docx!;
  const rowNo = src.row?.match(/(\d+)\s*$/)?.[1];
  const blocks: Extract<SourceView, { kind: "doc" }>["blocks"] = [];
  let any = false;
  d.paragraphs.forEach((p) => {
    const hit = !src.table && contains(p, src.snippet);
    any ||= hit;
    blocks.push({ type: "p", text: p, hit });
  });
  d.tables.forEach((t, ti) => {
    blocks.push({
      type: "table", n: ti + 1,
      rows: t.map((cells, ri) => {
        const text = cells.join(" | ");
        const inTable = src.table === ti + 1;
        const hit = inTable && (
          (rowNo !== undefined && Number(rowNo) === ri + 1 && (hasNumber(text, ex.valueText, ex.value) || contains(text, src.snippet))) ||
          (!!rowHint && cells.some((c) => norm(c) === norm(rowHint)) && hasNumber(text, ex.valueText, ex.value)));
        any ||= hit;
        // The cell that holds the value itself, so the panel can keep it in view.
        const value = hit ? cells.findIndex((c) => hasNumber(c, ex.valueText, ex.value)) : -1;
        return { cells, hit, ...(value >= 0 ? { value } : {}) };
      }),
    });
  });
  // A sentence cited without a table: mark the paragraph or row that holds the words.
  if (!any) for (const b of blocks) if (b.type === "table") for (const r of b.rows) if (contains(r.cells.join(" | "), src.snippet)) r.hit = true;
  return { kind: "doc", file: f.name, blocks };
}

function emailView(f: ReplyFile, src: SourceRef): SourceView {
  const e = f.email!;
  const lines = e.body.split(/\r?\n/).map((text) => ({ text, hit: Boolean(text.trim()) && (contains(text, src.snippet) || contains(src.snippet, text.trim())) }));
  return { kind: "email", file: f.name, headers: [["From", e.from], ["To", e.to], ["Date", e.date], ["Subject", e.subject]], lines };
}

async function pdfView(f: ReplyFile, src: SourceRef, ex: Expect, rowHint?: string): Promise<SourceView> {
  if (!f.base64) return { kind: "none", file: f.name, why: "The PDF could not be opened." };
  const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(f.base64, "base64")));
  const pageNo = Math.min(Math.max(1, src.page ?? 1), pdf.numPages);
  const page = await pdf.getPage(pageNo);
  const vp = page.getViewport({ scale: 1 });
  const tc = await page.getTextContent();
  const items = (tc.items as { str: string; transform: number[]; width: number; height: number }[])
    .filter((i) => i.str?.trim())
    .map((i) => ({ str: i.str, x: i.transform[4], y: vp.height - i.transform[5] - (i.height || Math.abs(i.transform[3])), w: i.width, h: i.height || Math.abs(i.transform[3]), hit: false, value: false }));
  // Group items into text lines by their vertical position, as the source check does.
  const lines: (typeof items)[] = [];
  for (const it of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const ln = lines.find((l) => Math.abs(l[0].y - it.y) < Math.max(2, it.h * 0.4));
    if (ln) ln.push(it);
    else lines.push([it]);
  }
  const label = rowHint ?? src.row ?? undefined;
  let found = false;
  for (const ln of lines) {
    const text = ln.sort((a, b) => a.x - b.x).map((i) => i.str).join(" ");
    const byRow = !!label && contains(text, label) && hasNumber(text, ex.valueText, ex.value);
    const bySnippet = contains(text, src.snippet) || (src.snippet.length > 12 && contains(src.snippet, text) && text.length > 12);
    if (byRow || bySnippet) {
      ln.forEach((i) => (i.hit = true));
      // The piece of the row that holds the value itself, so the panel can keep it in view.
      const v = ln.find((i) => hasNumber(i.str, ex.valueText, ex.value));
      if (v) v.value = true;
      found = true;
    }
  }
  return { kind: "pdf", file: f.name, page: pageNo, pages: pdf.numPages, width: vp.width, height: vp.height, items, found };
}

export async function sourceView(f: ReplyFile, src: SourceRef, ex: Expect, rowHint?: string): Promise<SourceView> {
  if (f.parseError) return { kind: "none", file: f.name, why: `The file could not be opened: ${f.parseError}` };
  if (f.kind === "xlsx" && f.sheets) return sheetView(f.name, f.sheets, src);
  if (f.kind === "docx" && f.docx) return docView(f, src, ex, rowHint);
  if (f.kind === "eml" && f.email) return emailView(f, src);
  if (f.kind === "pdf") return pdfView(f, src, ex, rowHint);
  if (f.kind === "image") return { kind: "image", file: f.name, path: f.path, region: src.region };
  return { kind: "none", file: f.name, why: "This kind of file cannot be drawn here; open the original." };
}

/** The buyer's own record (last year's workbook), drawn the same way. */
export function recordView(file: string, sheets: Sheet[], src: SourceRef): SourceView {
  return sheetView(file, sheets, src);
}
