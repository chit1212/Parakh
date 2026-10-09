// The RFQ as the vendor receives it: an Excel file built in code from the buyer's draft, in the
// same shape as the buyer's quote template (lines with a column for the price, the questionnaire,
// and the terms), so a reply can come back in it.
import ExcelJS from "exceljs";
import type { DraftRfq } from "@/lib/rfqDraft";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { draft, title, ref, due, buyer } = (await req.json().catch(() => ({}))) as { draft?: DraftRfq; title?: string; ref?: string; due?: string; buyer?: string };
  if (!draft?.lines) return Response.json({ error: "Nothing to export." }, { status: 400 });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Lines");
  ws.addRow([`Request for quotation ${ref ?? ""}: ${title ?? ""}`.trim()]).font = { bold: true, size: 13 };
  ws.addRow([`Reply by ${due ?? "the date in our email"} to ${buyer ?? "the buyer"}. ${draft.terms["Price basis"] ?? ""}`.trim()]);
  ws.addRow([]);
  ws.addRow(["Line", "Item", "Size", "Board and print", "Qty", "Your price", "Unit (per box / per 100 / per kg)", "Notes"]).font = { bold: true };
  for (const l of draft.lines) ws.addRow([l.id, l.name, l.size, l.spec, l.qty ?? "", "", "", ""]);
  [6, 36, 28, 60, 10, 12, 24, 30].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getColumn(5).numFmt = "#,##0";
  const q = wb.addWorksheet("Questionnaire");
  q.addRow(["No.", "Question", "Type", "Your answer"]).font = { bold: true };
  for (const x of draft.questions) q.addRow([x.id, x.text, x.type, ""]);
  [6, 70, 12, 50].forEach((w, i) => (q.getColumn(i + 1).width = w));
  const t = wb.addWorksheet("Terms");
  t.addRow(["Term", "Our requirement", "Your terms"]).font = { bold: true };
  for (const [k, v] of Object.entries(draft.terms)) t.addRow([k, v, ""]);
  [20, 80, 40].forEach((w, i) => (t.getColumn(i + 1).width = w));
  const buf = await wb.xlsx.writeBuffer();
  const name = `RFQ_${(ref ?? "draft").replace(/[^\w-]+/g, "_")}.xlsx`;
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${name}"` },
  });
}
