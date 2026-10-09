import type { SourceRef } from "./types";

/** "file, sheet Offer, cell G8" / "file, page 3" / "file, table 1, row 2" / "file, row 13". */
export function where(s: SourceRef | null): string {
  if (!s) return "no source";
  const parts = [s.file];
  if (s.sheet) parts.push(`sheet ${s.sheet}${s.cell ? `, cell ${s.cell}` : ""}`);
  if (s.page) parts.push(`page ${s.page}`);
  if (s.table) parts.push(`table ${s.table}${s.row ? `, row ${s.row}` : ""}`);
  else if (s.row) parts.push(`row ${s.row}`);
  return parts.join(", ");
}
