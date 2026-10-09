// No source, no entry: code checks that each value the model reported is really at the
// place it cited. This check does not use the model.
import type { Sheet } from "../files/xlsx";
import type { ReplyFile, SourceRef, Verification } from "../types";

export const norm = (s: string) =>
  s.normalize("NFKC").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-")
    .replace(/\s+/g, " ").trim().toLowerCase();

/** Same text with digit-grouping commas and spaces removed, for comparing numbers. */
const numNorm = (s: string) => norm(s).replace(/(\d),(?=\d)/g, "$1").replace(/\s+/g, "");

export function contains(hay: string, needle: string): boolean {
  if (!needle.trim()) return false;
  return norm(hay).includes(norm(needle)) || numNorm(hay).includes(numNorm(needle));
}

/** Does this text contain the number, either as written or as a plain number? */
export function hasNumber(text: string, valueText?: string, value?: number): boolean {
  if (valueText && contains(text, valueText)) return true;
  if (value === undefined) return false;
  const nums = (numNorm(text).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  return nums.some((n) => Math.abs(n - value) < 1e-9);
}

export interface RecordFile {
  file: string;
  sheets: Sheet[];
}

export interface Expect {
  /** The number that must be at the source, as written and as a number. */
  valueText?: string;
  value?: number;
}

const ok = (note: string): Verification => ({ status: "verified", note });
const fail = (note: string): Verification => ({ status: "failed", note });

function checkSheets(file: string, sheets: Sheet[], src: SourceRef, ex: Expect): Verification {
  if (!src.sheet || !src.cell) return fail(`No sheet and cell given for ${file}.`);
  const s = sheets.find((x) => x.name.toLowerCase() === src.sheet!.toLowerCase());
  if (!s) return fail(`Sheet "${src.sheet}" is not in ${file}.`);
  const c = s.cells.find((x) => x.ref.toUpperCase() === src.cell!.toUpperCase());
  if (!c) return fail(`Cell ${src.sheet}!${src.cell} is empty in ${file}.`);
  if (ex.value !== undefined || ex.valueText) {
    const numOk = typeof c.value === "number" && ex.value !== undefined && Math.abs(c.value - ex.value) < 1e-9;
    if (numOk || hasNumber(c.text, ex.valueText, ex.value)) return ok(`${src.sheet}!${c.ref} holds ${c.text}.`);
    return fail(`${src.sheet}!${c.ref} holds "${c.text}", not ${ex.valueText ?? ex.value}.`);
  }
  if (contains(c.text, src.snippet) || contains(src.snippet, c.text)) return ok(`${src.sheet}!${c.ref} reads "${c.text}".`);
  return fail(`${src.sheet}!${c.ref} reads "${c.text}", which does not match the quoted words.`);
}

function checkDocx(f: ReplyFile, src: SourceRef, ex: Expect): Verification {
  const d = f.docx!;
  if (src.table) {
    const t = d.tables[src.table - 1];
    if (!t) return fail(`Table ${src.table} is not in ${f.name}.`);
    let row: string[] | undefined;
    // "2", or the full label as printed in the text: "Table 1, row 2" / "row 2".
    const rowNo = src.row && /^\s*(?:(?:table\s*\d+\s*,\s*)?row\s*)?(\d+)\s*$/i.test(src.row)
      ? Number(src.row.match(/(\d+)\s*$/)![1])
      : null;
    if (rowNo) row = t[rowNo - 1];
    // A row given by its label (e.g. "L09") instead of its number.
    if (!row && src.row) row = t.find((r) => r.some((c) => norm(c) === norm(src.row!)));
    if (!row) return fail(`Row ${src.row ?? "?"} is not in table ${src.table} of ${f.name}.`);
    const text = row.join(" | ");
    if (ex.value !== undefined || ex.valueText) {
      return hasNumber(text, ex.valueText, ex.value)
        ? ok(`Table ${src.table}, row "${text}".`)
        : fail(`Table ${src.table} row "${text}" does not contain ${ex.valueText ?? ex.value}.`);
    }
    return contains(text, src.snippet) ? ok(`Table ${src.table}, row "${text}".`) : fail(`Quoted words not in table ${src.table}, row ${src.row}.`);
  }
  // Paragraph text: find the quoted words anywhere in the letter.
  const pIdx = d.paragraphs.findIndex((p) => contains(p, src.snippet));
  if (pIdx < 0) return fail(`The quoted words are not in ${f.name}.`);
  if ((ex.value !== undefined || ex.valueText) && !hasNumber(src.snippet, ex.valueText, ex.value))
    return fail(`The quoted words do not contain ${ex.valueText ?? ex.value}.`);
  return ok(`Paragraph ${pIdx + 1}.`);
}

function checkText(name: string, text: string, src: SourceRef, ex: Expect, where: string): Verification {
  if (!contains(text, src.snippet)) return fail(`The quoted words are not in ${where} of ${name}.`);
  if ((ex.value !== undefined || ex.valueText) && !hasNumber(src.snippet, ex.valueText, ex.value))
    return fail(`The quoted words do not contain ${ex.valueText ?? ex.value}.`);
  return ok(`Found in ${where}.`);
}

function checkPdf(f: ReplyFile, src: SourceRef, ex: Expect, rowHint?: string): Verification {
  const pages = f.pdfPages ?? [];
  if (!pages.some((p) => p.trim())) return { status: "photo", note: "Scanned PDF with no text layer: checked by eye, not by code." };
  if (!src.page) return fail(`No page number given for ${f.name}.`);
  const page = pages[src.page - 1];
  if (page === undefined) return fail(`${f.name} has no page ${src.page}.`);
  if (contains(page, src.snippet)) {
    if ((ex.value !== undefined || ex.valueText) && !hasNumber(src.snippet, ex.valueText, ex.value))
      return fail(`The quoted words on page ${src.page} do not contain ${ex.valueText ?? ex.value}.`);
    return ok(`Page ${src.page}: "${src.snippet}".`);
  }
  // PDF text layers break table rows apart; accept the value on the same text line as the row label.
  if (ex.valueText || ex.value !== undefined) {
    const label = rowHint ?? src.row;
    const lines = page.split(/\n/);
    const hit = lines.find((ln) => (!label || contains(ln, label)) && hasNumber(ln, ex.valueText, ex.value));
    if (hit && label) return ok(`Page ${src.page}, line "${hit.trim()}".`);
  }
  return fail(`The quoted words are not on page ${src.page} of ${f.name}.`);
}

/** Check one source. `files` are the reply's files; `records` the buyer's own records. */
export function verifySource(
  src: SourceRef | null,
  files: ReplyFile[],
  records: RecordFile[],
  ex: Expect = {},
  rowHint?: string,
): Verification {
  if (!src) return fail("No source given.");
  const want = src.file.toLowerCase().split(/[\\/]/).pop()!;
  const rec = records.find((r) => r.file.toLowerCase() === want);
  if (rec) return checkSheets(rec.file, rec.sheets, src, ex);
  const f = files.find((x) => x.name.toLowerCase() === want);
  if (!f) return fail(`"${src.file}" is not one of the files in this reply.`);
  if (f.kind === "image") return { status: "photo", note: "Read from a photo: code cannot check text in an image, so the checks below matter more." };
  if (f.kind === "xlsx" && f.sheets) return checkSheets(f.name, f.sheets, src, ex);
  if (f.kind === "docx" && f.docx) return checkDocx(f, src, ex);
  if (f.kind === "eml" && f.email) {
    const all = `${f.email.subject}\n${f.email.body}`;
    return checkText(f.name, all, src, ex, "the email");
  }
  if (f.kind === "text" && f.text) return checkText(f.name, f.text, src, ex, "the text");
  if (f.kind === "pdf") return checkPdf(f, src, ex, rowHint);
  return fail(`${f.name} cannot be checked.`);
}
