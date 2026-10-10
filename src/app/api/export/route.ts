// L30: export a frozen award (or the current view) as an Excel workbook or a PDF award memo.
// Built in code from the snapshot it is given; nothing is recalculated or sent anywhere.
import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Snapshot } from "@/lib/award";

export const runtime = "nodejs";

// Standard PDF fonts have no rupee sign; the memo writes "Rs".
const rs = (n: number) => `Rs ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const lakh = (n: number) => `Rs ${(n / 1e5).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`;
const crore = (n: number) => `Rs ${(n / 1e7).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`;
const ascii = (s: string) => s.replace(/₹/g, "Rs ").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, "-").replace(/→/g, "->").replace(/[^\x20-\x7e]/g, "");

export async function POST(req: Request) {
  const { snapshot: s, format } = (await req.json().catch(() => ({}))) as { snapshot?: Snapshot; format?: "xlsx" | "pdf" };
  if (!s?.rows?.length) return Response.json({ error: "Nothing to export." }, { status: 400 });
  const name = `${s.eventId}_award_${s.id}`;
  if (format === "pdf") {
    const bytes = await memo(s);
    return new Response(new Uint8Array(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${name}.pdf"` } });
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Award");
  ws.addRow([`${s.eventId}: ${s.title}`]).font = { bold: true, size: 13 };
  ws.addRow([`Basis: ${s.basis}. Price per box, INR, delivered Chakan, GST extra.${s.partial ? ` Shown: ${s.partial}.` : ""}`]);
  ws.addRow([`Snapshot saved ${s.frozenAt} by ${s.frozenBy} · snapshot ${s.id}${s.approvedBy ? ` · approved by ${s.approvedBy} ${s.approvedAt}` : " · not yet approved"}`]);
  ws.addRow([]);
  const hdr = ws.addRow(["Line", "Box", "Awarded to", "INR per box", "Qty", "Value INR", "As written", "Calculation", "Source", "Approved by"]);
  hdr.font = { bold: true };
  for (const r of s.rows) ws.addRow([r.lineId, r.name, r.vendor ?? "none", r.perBox, r.qty, r.value, r.asWritten, r.calc, r.where, r.checked ? `${r.checked.who}, ${r.checked.at.slice(0, 16).replace("T", " ")} UTC` : "not yet"]);
  ws.addRow([]);
  ws.addRow(["", "Total", "", "", "", s.total]).font = { bold: true };
  ws.getColumn(4).numFmt = "#,##0.00";
  ws.getColumn(6).numFmt = "#,##,##0";
  [6, 34, 14, 12, 10, 14, 30, 40, 50, 30].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const r2 = wb.addWorksheet("Rules and decisions");
  r2.addRow(["Rules applied"]).font = { bold: true };
  s.rules.forEach((t, i) => r2.addRow([`R${i + 1}`, t]));
  r2.addRow([]);
  r2.addRow(["Excluded, and why"]).font = { bold: true };
  (s.excluded.length ? s.excluded : [{ name: "None", why: "" }]).forEach((x) => r2.addRow([x.name, x.why]));
  r2.addRow([]);
  r2.addRow(["Decisions on record"]).font = { bold: true };
  s.decisions.forEach((d) => r2.addRow([d.title, d.status]));
  const r3 = wb.addWorksheet("Audit trail");
  r3.addRow(["When (UTC)", "Who", "What", "Why"]).font = { bold: true };
  for (const a of s.audit ?? []) r3.addRow([a.at.slice(0, 16).replace("T", " "), a.who, a.what, a.why]);
  [18, 22, 70, 60].forEach((w, i) => (r3.getColumn(i + 1).width = w));
  r2.getColumn(1).width = 60;
  r2.getColumn(2).width = 80;
  const buf = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buf as ArrayBuffer), {
    headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${name}.xlsx"` },
  });
}

async function memo(s: Snapshot): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const M = 48, W = 595 - 2 * M;
  const line = (t: string, o: { size?: number; f?: typeof font; gap?: number; color?: number } = {}) => {
    const size = o.size ?? 10, f = o.f ?? font;
    const words = ascii(t).split(" ");
    let cur = "";
    const flush = () => {
      if (y < 60) { page = pdf.addPage([595, 842]); y = 800; }
      page.drawText(cur, { x: M, y, size, font: f, color: rgb(o.color ?? 0.12, o.color ?? 0.12, o.color ?? 0.11) });
      y -= size + (o.gap ?? 4);
      cur = "";
    };
    for (const w of words) {
      if (f.widthOfTextAtSize(cur ? `${cur} ${w}` : w, size) > W) flush();
      cur = cur ? `${cur} ${w}` : w;
    }
    if (cur) flush();
  };
  line(`AWARD MEMO · ${s.eventId}`, { size: 9, color: 0.4 });
  line(s.title, { size: 18, f: bold, gap: 8 });
  line(`Basis: ${s.basis}. Every price per box, in rupees, delivered Chakan, GST extra.`);
  line(`Snapshot saved ${s.frozenAt.slice(0, 16).replace("T", " ")} UTC by ${s.frozenBy} · snapshot ${s.id} · ${s.approvedBy ? `approved by ${s.approvedBy}` : "for approval"}`, { color: 0.4, gap: 10 });
  line(`Award value ${crore(s.total)} · ${s.total >= s.cheapestOverall ? "+" : "-"}${lakh(Math.abs(s.total - s.cheapestOverall))} against cheapest overall (${crore(s.cheapestOverall)})`, { f: bold });
  if (s.lastYear) line(`Like-for-like against last year on ${s.lastYear.lines} lines: ${lakh(s.lastYear.thisYear)} this year vs ${lakh(s.lastYear.lastYear)} last year.`);
  line(`Split: ${s.byVendor.map((v) => `${v.vendor} ${v.lines} lines (${lakh(v.value)})`).join("; ")}.`, { gap: 10 });
  line("Rules applied", { f: bold, size: 12 });
  s.rules.forEach((t, i) => line(`R${i + 1}. ${t}`));
  if (s.excluded.length) { y -= 4; line("Excluded, and why", { f: bold, size: 12 }); s.excluded.forEach((x) => line(`${x.name}: ${x.why}`)); }
  y -= 4;
  line("Decisions on record", { f: bold, size: 12 });
  s.decisions.forEach((d) => line(`${d.title}: ${d.status}`));
  if (s.audit?.length) {
    y -= 4;
    line("Approvals, decisions and overrides (UTC)", { f: bold, size: 12 });
    s.audit.forEach((a) => line(`${a.at.slice(0, 16).replace("T", " ")} · ${a.who}: ${a.what}. Why: ${a.why}`));
  }
  y -= 6;
  line("Snapshot at decision", { f: bold, size: 12 });
  const cols = [M, M + 34, M + 230, M + 310, M + 370, M + 430];
  const row = (cells: string[], f = font) => {
    if (y < 60) { page = pdf.addPage([595, 842]); y = 800; }
    cells.forEach((c, i) => page.drawText(ascii(c).slice(0, i === 1 ? 38 : 40), { x: cols[i], y, size: 8.5, font: f }));
    y -= 12;
  };
  row(["Line", "Box", "Awarded to", "Rs/box", "Qty", "Source"], bold);
  for (const r of s.rows) row([r.lineId, r.name, r.vendor ?? "none", r.perBox != null ? rs(r.perBox).replace("Rs ", "") : "-", r.qty.toLocaleString("en-IN"), (r.where ?? "").replace(/^[^,]+, /, "").slice(0, 30)]);
  y -= 6;
  line(`Total ${rs(s.total)}. Every number traces to its source in Parakh. The AI recommends; the buyer decides.`, { color: 0.4 });
  return pdf.save();
}
