import type { SourceRef } from "./types";

/** "file, sheet Offer, cell G8" / "file, page 3" / "file, table 1, row 2" / "file, row 13". */
export function where(s: SourceRef | null): string {
  if (!s) return "no source";
  const parts = [s.file];
  if (s.sheet) parts.push(`sheet ${s.sheet}${s.cell ? `, cell ${s.cell}` : ""}`);
  if (s.page) parts.push(`page ${s.page}`);
  const row = s.row?.replace(/^(table\s*\d+\s*,\s*)?row\s*/i, "");
  if (s.table) parts.push(`table ${s.table}${row ? `, row ${row}` : ""}`);
  else if (row) parts.push(`row ${row}`);
  return parts.join(", ");
}

/** "9 Oct 2026", in India time (the buyer's). */
export function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

/** "read on 9 Oct 2026 by gemini-3.8-flash" */
export function readStamp(r: { readAt: string | null; models: string[] }): string {
  if (!r.readAt) return "read in code, no model needed";
  return `read on ${day(r.readAt)} by ${r.models.join(" and ")}`;
}

/** 4,134.00 (Indian grouping, two decimals). */
export const num2 = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** ₹41.80 */
export const inr = (n: number) => `₹${num2(n)}`;
/** ₹6.99 L (lakhs) */
export const lakh = (n: number) => `₹${(n / 1e5).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
/** ₹4.01 Cr (crores) */
export const crore = (n: number) => `₹${(n / 1e7).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
