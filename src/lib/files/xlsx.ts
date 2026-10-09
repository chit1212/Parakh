// Spreadsheets are parsed in code, keeping every value's sheet and cell reference.
import ExcelJS from "exceljs";

export interface SheetCell {
  ref: string; // "G8"
  row: number;
  col: number;
  value: string | number | boolean | null;
  text: string; // as displayed
}

export interface Sheet {
  name: string;
  cells: SheetCell[];
  merged: string[];
}

function cellValue(v: ExcelJS.CellValue): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("result" in v) return cellValue(v.result as ExcelJS.CellValue);
    if ("text" in v) return String(v.text);
    if ("error" in v) return String(v.error);
  }
  return String(v);
}

export async function readWorkbook(buf: Buffer | ArrayBuffer): Promise<Sheet[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as ArrayBuffer);
  const sheets: Sheet[] = [];
  wb.eachSheet((ws) => {
    const cells: SheetCell[] = [];
    ws.eachRow({ includeEmpty: false }, (row, r) => {
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        // A merged range repeats its master value in every cell; keep only the master.
        if (cell.isMerged && cell.master.address !== cell.address) return;
        const value = cellValue(cell.value);
        if (value === null || value === "") return;
        cells.push({ ref: cell.address, row: r, col: c, value, text: String(value) });
      });
    });
    // exceljs keeps merges on the model; read them without relying on private fields.
    const merged = ((ws.model as unknown as { merges?: string[] }).merges ?? []).slice();
    sheets.push({ name: ws.name, cells, merged });
  });
  return sheets;
}

/** Text shown to the model: one line per row, every value tagged with its cell reference. */
export function workbookToText(fileName: string, sheets: Sheet[]): string {
  const out: string[] = [`Workbook: ${fileName}`];
  for (const s of sheets) {
    out.push("", `=== Sheet "${s.name}"` + (s.merged.length ? ` (merged cells: ${s.merged.join(", ")})` : ""));
    const rows = new Map<number, SheetCell[]>();
    for (const c of s.cells) rows.set(c.row, [...(rows.get(c.row) ?? []), c]);
    for (const [r, cells] of [...rows.entries()].sort((a, b) => a[0] - b[0])) {
      out.push(`Row ${r}: ` + cells.map((c) => `[${c.ref}] ${c.text}`).join(" | "));
    }
  }
  return out.join("\n");
}

export function findCell(sheets: Sheet[], sheet: string, ref: string): SheetCell | undefined {
  const s = sheets.find((x) => x.name.toLowerCase() === sheet.toLowerCase());
  return s?.cells.find((c) => c.ref.toUpperCase() === ref.toUpperCase());
}
