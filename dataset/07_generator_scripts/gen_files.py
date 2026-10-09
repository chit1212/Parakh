import os, json, math, random
from master import *
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import docx
from docx.shared import Pt, Cm

OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))
for d in ["01_rfq", "02_inbox", "03_vendor_replies/1_shree_balaji_excel", "03_vendor_replies/2_vardhman_pdf",
          "03_vendor_replies/3_kaveri_word", "03_vendor_replies/4_anand_photo", "03_vendor_replies/5_rohit_email",
          "03_vendor_replies/6_revised_quote", "04_history", "05_failure_cases", "06_answer_key"]:
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

pdfmetrics.registerFont(TTFont("DV", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DVB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DVS", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"))
pdfmetrics.registerFont(TTFont("DVSB", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"))
ss = getSampleStyleSheet()
def st(name, font="DV", size=9, lead=None, **kw):
    return ParagraphStyle(name, parent=ss["Normal"], fontName=font, fontSize=size, leading=lead or size * 1.3, **kw)
P9 = st("p9"); P8 = st("p8", size=8); H1 = st("h1", "DVB", 15); H2 = st("h2", "DVB", 11, spaceBefore=6, spaceAfter=3)
SMALL = st("sm", size=7, textColor=colors.grey)
FICT = "Fictional demo document. All companies, people, certificate numbers and prices are invented."
L = {l["id"]: l for l in LINES}
def p(path):
    return os.path.join(OUT, path)

# ---------------------------------------------------------------- RFQ
def rfq():
    doc = SimpleDocTemplate(p("01_rfq/SE-2026-041_RFQ_Corrugated_Boxes.pdf"), pagesize=A4,
                            leftMargin=15*mm, rightMargin=15*mm, topMargin=14*mm, bottomMargin=14*mm)
    s = []
    s.append(Paragraph(f"{EVENT['buyer_co']}", H1))
    s.append(Paragraph(f"{EVENT['plant']} &nbsp;|&nbsp; Procurement, Packaging", P9))
    s.append(Spacer(1, 6))
    s.append(Paragraph(f"Request for Quotation {EVENT['id']}: {EVENT['title']}", H2))
    meta = [["Issued", EVENT["issued"], "Quotes due", EVENT["due"] + ", 18:00 IST"],
            ["Buyer", f"{EVENT['buyer']}, Category Buyer", "Reply to", "rfq-se2026041@sahyadri-appliances.example"],
            ["Supply period", "Oct 2026 to Mar 2027 (FY27 H2)", "Delivery", "Plant 2, MIDC Chakan, in weekly call-offs"]]
    t = Table(meta, colWidths=[24*mm, 64*mm, 24*mm, 68*mm])
    t.setStyle(TableStyle([("FONT", (0, 0), (-1, -1), "DV", 8), ("FONT", (0, 0), (0, -1), "DVB", 8), ("FONT", (2, 0), (2, -1), "DVB", 8),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    s.append(t)
    s.append(Spacer(1, 6))
    s.append(Paragraph("<b>How to quote.</b> Please quote a price <b>per box</b> (per piece for accessories) in <b>INR</b>, "
                       "<b>delivered to Plant 2 Chakan</b>, with <b>GST shown separately</b>. Quote every line. If you cannot "
                       "meet a specification, say so and quote your alternative on a separate line. State price validity, "
                       "payment terms and lead time. You may use the attached Excel template or your own format. "
                       "Please also answer the quality questionnaire in Section 3 and attach the documents it asks for.", P9))
    s.append(Paragraph("1. Line items", H2))
    rows = [["Line", "Item", "Size", "Board and print", "Qty (H2)"]]
    for l in LINES:
        rows.append([l["id"], Paragraph(l["name"], P8), Paragraph(l["size"], P8), Paragraph(l["spec"], P8), f"{l['qty']:,}"])
    t = Table(rows, colWidths=[11*mm, 46*mm, 34*mm, 72*mm, 17*mm], repeatRows=1)
    t.setStyle(TableStyle([("FONT", (0, 0), (-1, 0), "DVB", 8), ("FONT", (0, 1), (-1, -1), "DV", 8),
                           ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8e6df")), ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
                           ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (4, 1), (4, -1), "RIGHT")]))
    s.append(t)
    s.append(Paragraph("Notes: sizes are internal dimensions. All cartons are regular slotted cartons (RSC) unless stated. "
                       "L21 is now 7-ply (it was 5-ply in SE-2025-037). L28 and L29 are new SKUs for the air fryer launch.", P8))
    s.append(Paragraph("2. Commercial terms", H2))
    for txt in ["Prices firm for the supply period, or state your validity.", "Payment: 60 days from receipt of goods (please state if different).",
                "Delivery: weekly call-offs against monthly purchase orders. Monthly PO value per vendor is expected to be between INR 15 and 30 lakh, depending on how the award is split.",
                "Quality: boxes must meet the board grade stated; each lot needs a test certificate.",
                "Freight, loading and any handling charges must be included in the delivered price or shown separately."]:
        s.append(Paragraph("&bull; " + txt, P9))
    s.append(Paragraph("3. Quality questionnaire", H2))
    s.append(Paragraph(f"Pass rule: {PASS_RULE}. Score out of 100.", P9))
    qrows = [["No.", "Question", "Type"]] + [[q[0], Paragraph(q[1], P8), q[2]] for q in QUESTIONS]
    t = Table(qrows, colWidths=[12*mm, 140*mm, 28*mm])
    t.setStyle(TableStyle([("FONT", (0, 0), (-1, 0), "DVB", 8), ("FONT", (0, 1), (-1, -1), "DV", 8), ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
                           ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8e6df"))]))
    s.append(t)
    s.append(Spacer(1, 8)); s.append(Paragraph(FICT, SMALL))
    doc.build(s)

    wb = Workbook(); ws = wb.active; ws.title = "Quote template"
    ws.append([f"{EVENT['id']} {EVENT['title']}: quotation template"]); ws["A1"].font = Font(bold=True, size=12)
    ws.append(["Vendor name:", ""]); ws.append(["Price validity (days):", ""]); ws.append([])
    hdr = ["Line", "Item", "Size", "Board and print", "Qty", "Price per box, INR, delivered Chakan, ex-GST", "GST %", "Remarks"]
    ws.append(hdr)
    for c in ws[5]: c.font = Font(bold=True); c.fill = PatternFill("solid", fgColor="E8E6DF")
    for l in LINES:
        ws.append([l["id"], l["name"], l["size"], l["spec"], l["qty"], None, 18, None])
    for col, w in zip("ABCDEFGH", [6, 40, 26, 60, 9, 22, 7, 30]):
        ws.column_dimensions[col].width = w
    q = wb.create_sheet("Questionnaire")
    q.append(["No.", "Question", "Type", "Your answer"])
    for c in q[1]: c.font = Font(bold=True)
    for x in QUESTIONS: q.append([x[0], x[1], x[2], None])
    q.column_dimensions["B"].width = 80; q.column_dimensions["D"].width = 50
    wb.save(p("01_rfq/SE-2026-041_Quote_Template.xlsx"))

# ---------------------------------------------------------------- Shree Balaji Excel (ignores template)
SB_CODES = {}
def sb_xlsx(version):
    wb = Workbook(); ws = wb.active; ws.title = "Offer"
    thin = Side(style="thin", color="999999")
    ws.merge_cells("A1:H1"); ws["A1"] = "SHREE BALAJI CORRUGATORS"; ws["A1"].font = Font(bold=True, size=16, color="7A1F1F")
    ws.merge_cells("A2:H2"); ws["A2"] = "Plot T-41, Bhosari MIDC, Pune 411026 | GSTIN 27AAXFS0000X1Z5 (demo)"
    ws.merge_cells("A3:H3"); ws["A3"] = f"Our offer no. SBC/OFF/26-27/{'0418' if version == 1 else '0418-R1'} dated {'01-10-2026' if version == 1 else '07-10-2026'} | Kind Attn: Mr. Vikram Deshpande | Ref: your enquiry SE-2026-041"
    if version == 2:
        ws.merge_cells("A4:H4"); ws["A4"] = "REVISED OFFER (R1) - supersedes our offer 0418 dated 01-10-2026. Changes on our items CB-0107, CB-0211, CB-0324 after discussion."
        ws["A4"].font = Font(bold=True, color="C00000")
    start = 6
    hdr = ["Sr", "Our item code", "Description (as per your enquiry)", "Box size mm", "Ply / Paper", "Print", "Rate Rs/pc ex-works", "Your qty"]
    for i, h in enumerate(hdr, 1):
        c = ws.cell(row=start, column=i, value=h); c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="7A1F1F")
        c.alignment = Alignment(wrap_text=True, vertical="center")
    # vendor's own grouping: ply-wise, own order, own descriptions
    order = sorted(LINES, key=lambda l: (l["ply_n"], l["id"]))
    r = start + 1; sr = 1
    group = None
    for l in order:
        g = {3: "3 PLY ITEMS", 5: "5 PLY ITEMS", 7: "7 PLY ITEMS"}[l["ply_n"]]
        if g != group:
            ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=8)
            ws.cell(row=r, column=1, value=g).font = Font(bold=True); ws.cell(row=r, column=1).fill = PatternFill("solid", fgColor="F2DCDB")
            r += 1; group = g
        code = f"CB-{l['ply_n']}{int(l['id'][1:]):02d}{(sr * 7) % 10}"
        SB_CODES[l["id"]] = code
        price = PRICES["SB"][l["id"]]
        if version == 2 and l["id"] in SB_V2_CHANGES:
            price = r2(price * SB_V2_CHANGES[l["id"]])
        exw = r2(price - SB_FREIGHT)
        desc = l["name"].replace(", unit carton", " box").replace("carton", "ctn").upper()
        size = l["size"].replace(" (internal)", " ID").replace(" mm", "")
        printing = f"{l['colours']} clr" if l["colours"] else "plain"
        ws.append([sr, code, desc, size, l["ply"].replace("-ply", " ply"), printing, exw, l["qty"]])
        for c in range(1, 9): ws.cell(row=r, column=c).border = Border(top=thin, bottom=thin, left=thin, right=thin)
        ws.cell(row=r, column=7).number_format = "0.00"
        r += 1; sr += 1
    r += 1
    ws.cell(row=r, column=1, value="Rates are per piece EX-WORKS Bhosari. GST @18% extra. Delivery terms, freight and other conditions as per sheet 'T&C'.").font = Font(italic=True)
    for col, w in zip("ABCDEFGH", [5, 13, 44, 22, 12, 8, 16, 10]):
        ws.column_dimensions[col].width = w
    t = wb.create_sheet("T&C")
    terms = [("Price basis", "Ex-works Bhosari, Pune"),
             ("Freight", f"Rs {SB_FREIGHT:.2f} per box to Chakan, billed in invoice"),
             ("GST", "18% extra"), ("Payment", "45 days from invoice"),
             ("Validity", "30 days" if version == 1 else "60 days (extended in R1)"),
             ("Lead time", "10 days from PO"), ("Tolerance", "Qty +/- 5% per call-off"),
             ("Paper price clause", "Rates subject to revision if kraft paper price moves more than 5% (base: Oct 2026)")]
    t.append(["Term", "Our condition"])
    for c in t[1]: c.font = Font(bold=True)
    for a, b in terms: t.append([a, b])
    t.column_dimensions["A"].width = 20; t.column_dimensions["B"].width = 80
    t.append([]); t.append([FICT])
    name = "SBC_Offer_0418_SE-2026-041.xlsx" if version == 1 else "SBC_Offer_0418-R1_REVISED.xlsx"
    folder = "03_vendor_replies/1_shree_balaji_excel" if version == 1 else "03_vendor_replies/6_revised_quote"
    wb.save(p(f"{folder}/{name}"))

# ---------------------------------------------------------------- Vardhman PDF (USD, footnote discount)
def vp_pdf():
    path = p("03_vendor_replies/2_vardhman_pdf/Vardhman_Quotation_VPE-Q-2611.pdf")
    def letterhead(c, d):
        c.saveState()
        c.setFillColor(colors.HexColor("#123c69")); c.rect(0, A4[1] - 30*mm, A4[0], 30*mm, stroke=0, fill=1)
        c.setFillColor(colors.white); c.setFont("DVSB", 18); c.drawString(15*mm, A4[1] - 15*mm, "VARDHMAN PACKWELL EXPORTS")
        c.setFont("DVS", 8.5); c.drawString(15*mm, A4[1] - 21*mm, "Corrugated packaging for domestic and export customers  |  Ranjangaon MIDC, Pune 412220")
        c.drawString(15*mm, A4[1] - 25.5*mm, "exports@vardhmanpackwell.example  |  ISO 9001:2015  |  FSC chain of custody")
        c.setFillColor(colors.grey); c.setFont("DV", 7)
        c.drawString(15*mm, 8*mm, FICT); c.drawRightString(A4[0] - 15*mm, 8*mm, f"Page {d.page} of 3")
        c.restoreState()
    doc = SimpleDocTemplate(path, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=38*mm, bottomMargin=16*mm)
    s = []
    s.append(Paragraph("QUOTATION VPE-Q-2611 &nbsp;&nbsp; Date: 02 October 2026", H2))
    s.append(Paragraph(f"To: {EVENT['buyer']}, {EVENT['buyer_role']}, {EVENT['buyer_co']}, {EVENT['plant']}<br/>"
                       "Subject: Your RFQ SE-2026-041, corrugated boxes for FY27 H2", P9))
    s.append(Spacer(1, 4))
    s.append(Paragraph("Dear Mr. Deshpande, thank you for your enquiry. As an export house we maintain all our price lists in US dollars. "
                       "Please find our best rates below, delivered to your Chakan plant, packed on pallets. GST will be charged extra at the applicable rate.", P9))
    rows = [["Line", "Description", "Construction", "Qty", "USD / box ‡"]]
    for l in LINES:
        usd = PRICES["VP"][l["id"]] / USD_RATE
        rows.append([l["id"], Paragraph(l["name"], P8), Paragraph(f"{l['ply']}, {l['colours']} col" if l["colours"] else f"{l['ply']}, plain", P8),
                     f"{l['qty']:,}", f"{usd:.4f}"])
    t = Table(rows, colWidths=[12*mm, 70*mm, 46*mm, 20*mm, 32*mm], repeatRows=1)
    t.setStyle(TableStyle([("FONT", (0, 0), (-1, 0), "DVB", 8), ("FONT", (0, 1), (-1, -1), "DV", 8),
                           ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dfe7f1")), ("LINEBELOW", (0, 0), (-1, -1), 0.25, colors.HexColor("#b8c4d4")),
                           ("ALIGN", (3, 1), (-1, -1), "RIGHT"), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    s.append(t)
    s.append(PageBreak())
    s.append(Paragraph("Commercial terms", H2))
    for a, b in [("Price basis", "Delivered Plant 2, MIDC Chakan, on returnable pallets"), ("Currency", "US dollars. Invoiced in INR at the exchange rate on the invoice date."),
                 ("GST", "Extra as applicable"), ("Payment", "60 days"), ("Validity", "45 days from date of quotation"), ("Lead time", "14 days from PO"),
                 ("Discount", "See note ‡ on page 3")]:
        s.append(Paragraph(f"<b>{a}:</b> {b}", P9))
    s.append(Paragraph("Quality questionnaire (your Section 3)", H2))
    qrows = [["No.", "Question", "Our answer"]] + [[q[0], Paragraph(q[1], P8), Paragraph(a, P8)] for q, a in zip(QUESTIONS, QA["VP"]["answers"])]
    t = Table(qrows, colWidths=[12*mm, 80*mm, 88*mm])
    t.setStyle(TableStyle([("FONT", (0, 0), (-1, 0), "DVB", 8), ("FONT", (0, 1), (-1, -1), "DV", 8), ("GRID", (0, 0), (-1, -1), 0.3, colors.grey), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    s.append(t)
    s.append(PageBreak())
    s.append(Paragraph("Notes", H2))
    s.append(Paragraph("1. Rates are based on kraft paper prices as of September 2026.", P8))
    s.append(Paragraph("2. Pallet deposit of USD 9 per pallet is refunded on return of pallets in good condition.", P8))
    s.append(Paragraph("3. Printing plates are supplied free of cost for orders above 10,000 pieces per design.", P8))
    s.append(Spacer(1, 4))
    s.append(Paragraph("‡ A trade discount of 2.5% applies on the invoice value of all items, provided the value of a single purchase order "
                       "exceeds INR 25,00,000. Rates shown are before this discount.", st("fn", size=6.5, textColor=colors.HexColor("#444444"))))
    s.append(Spacer(1, 10))
    s.append(Paragraph("For Vardhman Packwell Exports<br/><br/>Ritu Jain, Export Sales", P9))
    doc.build(s, onFirstPage=letterhead, onLaterPages=letterhead)

# ---------------------------------------------------------------- Kaveri Word (per 100 pcs, commercials in paragraph)
def kp_docx():
    d = docx.Document()
    sty = d.styles["Normal"]; sty.font.name = "Calibri"; sty.font.size = Pt(10.5)
    h = d.add_paragraph(); r = h.add_run("KAVERI PAPER PRODUCTS"); r.bold = True; r.font.size = Pt(16)
    d.add_paragraph("Gat No. 512, Talegaon Dabhade, Pune 410507  |  sales@kaveripaper.example")
    d.add_paragraph("Date: 3rd October 2026")
    d.add_paragraph("To,\nMr. Vikram Deshpande\nSahyadri Appliances Pvt. Ltd., Chakan")
    d.add_paragraph("Sub: Quotation against your RFQ SE-2026-041")
    d.add_paragraph("Respected Sir,")
    d.add_paragraph("With reference to the above enquiry, we are pleased to submit our rates for corrugated boxes as below. "
                    "As is our practice, all rates are given per 100 pieces.")
    t = d.add_table(rows=1, cols=5); t.style = "Table Grid"
    for i, h in enumerate(["Line", "Item", "Ply", "Qty", "Rate per 100 pcs (Rs.)"]):
        t.rows[0].cells[i].text = h
        t.rows[0].cells[i].paragraphs[0].runs[0].bold = True
    for l in LINES:
        per100 = r2((PRICES["KP"][l["id"]] - KP_FREIGHT * (1 + KP_HANDLING)) * 100)
        if l["id"] == KP_TYPO_LINE:
            per100 = 579.00
        row = t.add_row().cells
        row[0].text = l["id"]; row[1].text = l["name"]; row[2].text = l["ply"]; row[3].text = f"{l['qty']:,}"; row[4].text = f"{per100:,.2f}"
    d.add_paragraph()
    d.add_paragraph(
        "The above rates are ex our works at Talegaon and GST at 18% will be charged extra. Transportation to your Chakan plant will be arranged "
        "by us through our regular transporter at Rs. 0.40 per box, on which a handling charge of 15% will be added and billed separately in the "
        "invoice. Payment may kindly be released within 45 days of delivery. These rates are valid for 30 days from the date of this letter, "
        "after which they may change depending on the price of kraft paper. Delivery will be made within 12 days of receipt of your purchase order. "
        "For printed items, the cost of printing plates (cylinders) will be borne by you, and is charged once per design at actuals.")
    d.add_paragraph("Our replies to your quality questionnaire are given below.")
    q = d.add_table(rows=1, cols=3); q.style = "Table Grid"
    for i, h in enumerate(["No.", "Question", "Our reply"]): q.rows[0].cells[i].text = h
    for qq, a in zip(QUESTIONS, QA["KP"]["answers"]):
        c = q.add_row().cells; c[0].text = qq[0]; c[1].text = qq[1]; c[2].text = a
    d.add_paragraph()
    d.add_paragraph("Thanking you and assuring you of our best services at all times.\n\nYours faithfully,\nFor Kaveri Paper Products\n\nPrakash Kulkarni\nProprietor")
    f = d.add_paragraph(FICT); f.runs[0].font.size = Pt(7)
    d.save(p("03_vendor_replies/3_kaveri_word/Kaveri_Quotation_SE-2026-041.docx"))

# ---------------------------------------------------------------- Rohit email
def rb_email():
    body = """From: Rohit Gaikwad <rohit.gaikwad@rohitbox.example>
To: rfq-se2026041@sahyadri-appliances.example
Cc: Vikram Deshpande <vikram.deshpande@sahyadri-appliances.example>
Date: Fri, 3 Oct 2026 21:47:12 +0530
Subject: Re: RFQ SE-2026-041 corrugated boxes

Vikram ji,

₹42/kg for the 5-ply, 38 for the 3-ply, rest same as last year, freight extra.

Will send formal letter on Monday if required.

Rohit
Rohit Box Industries, Shikrapur
Sent from my phone
"""
    open(p("03_vendor_replies/5_rohit_email/Re_RFQ_SE-2026-041.eml"), "w").write(body)

# ---------------------------------------------------------------- Last year's records
def history():
    wb = Workbook(); ws = wb.active; ws.title = "Award summary"
    ws.append([f"{EVENT['ly_event']} Corrugated boxes FY26 H2: award summary (approved 18 Apr 2026)"]); ws["A1"].font = Font(bold=True)
    ws.append(["Line", "Item", "Board", "Awarded to", "Awarded price INR/box delivered ex-GST"])
    for c in ws[2]: c.font = Font(bold=True)
    for l in LINES:
        if l["id"] not in LY: continue
        ply = "5-ply BC" if l["id"] in SPEC_CHANGED else l["ply"]
        ws.append([l["id"], l["name"], ply, LY[l["id"]]["vendor"], LY[l["id"]]["price"]])
    for col, w in zip("ABCDE", [6, 44, 12, 28, 18]): ws.column_dimensions[col].width = w
    rb = wb.create_sheet("Rohit Box quote FY26 H2")
    rb.append(["Rohit Box Industries, quote dated 02 Apr 2026 against SE-2025-037 (as recorded by buyer)"])
    rb.append(["Item", "Rate"])
    for a, b in [("3-ply, per kg of box weight", 36.0), ("5-ply, per kg of box weight", 40.0), ("7-ply, per kg of box weight", 44.0),
                 ("Printing, per colour per box", 0.20), ("Die-cutting, per piece", 0.15), ("Freight", "Rs 0.30 per box to Chakan")]:
        rb.append([a, b])
    rb.column_dimensions["A"].width = 40; rb.column_dimensions["B"].width = 28
    wb.create_sheet("Note").append([FICT])
    wb.save(p("04_history/SE-2025-037_Award_Summary.xlsx"))

# ---------------------------------------------------------------- supporting docs: certificates & test reports
def cert(vendor_id, kind):
    v = next(x for x in VENDORS if x["id"] == vendor_id); qa = QA[vendor_id]
    fname = {"iso": f"{vendor_id}_ISO9001_Certificate_SAMPLE.pdf", "test": f"{vendor_id}_Box_Test_Report_SAMPLE.pdf"}[kind]
    folder = {"SB": "1_shree_balaji_excel", "VP": "2_vardhman_pdf", "KP": "3_kaveri_word", "AC": "4_anand_photo"}[vendor_id]
    doc = SimpleDocTemplate(p(f"03_vendor_replies/{folder}/{fname}"), pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm)
    s = [Paragraph("SAMPLE DOCUMENT FOR A PRODUCT DEMO. NOT A REAL CERTIFICATE.", st("w", "DVB", 9, textColor=colors.red)), Spacer(1, 8)]
    if kind == "iso":
        num = qa["answers"][0].split("no. ")[1].split(",")[0]
        valid = qa["answers"][0].split("valid to ")[1]
        s += [Paragraph("Deccan Quality Certification Services (fictional)", H1), Spacer(1, 10),
              Paragraph("Certificate of Registration", H2),
              Paragraph(f"This is to certify that the quality management system of <b>{v['name']}</b>, {v['city']}, "
                        f"has been assessed and found to conform to ISO 9001:2015 for the manufacture of corrugated boxes and sheets.", P9),
              Spacer(1, 6), Paragraph(f"Certificate no.: {num}<br/>Valid until: {valid}", P9)]
    else:
        s += [Paragraph(f"{v['name']}: in-house laboratory", H1), Paragraph("Box compression and bursting strength test report", H2),
              Paragraph(f"Test date: <b>{qa['test_date']}</b><br/>Samples: 5-ply BC, 180/120/120/120/150 GSM<br/>"
                        "Bursting strength: 14.2 kg/cm2 (spec 12.0 min)<br/>Box compression test: 412 kgf (spec 380 min)<br/>Moisture: 7.8%", P9)]
    s += [Spacer(1, 20), Paragraph(FICT, SMALL)]
    doc.build(s)

def ac_questionnaire():
    doc = SimpleDocTemplate(p("03_vendor_replies/4_anand_photo/Anand_Questionnaire_reply.pdf"), pagesize=A4, leftMargin=18*mm, rightMargin=18*mm)
    s = [Paragraph("ANAND CARTONS, CHAKAN", H1), Paragraph("Reply to quality questionnaire, RFQ SE-2026-041", H2)]
    rows = [["No.", "Question", "Reply"]] + [[q[0], Paragraph(q[1], P8), Paragraph(a, P8)] for q, a in zip(QUESTIONS, QA["AC"]["answers"])]
    t = Table(rows, colWidths=[12*mm, 85*mm, 77*mm]); t.setStyle(TableStyle([("FONT", (0, 0), (-1, -1), "DV", 8), ("GRID", (0, 0), (-1, -1), 0.3, colors.grey), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    s += [t, Spacer(1, 10), Paragraph(FICT, SMALL)]
    doc.build(s)

def sb_questionnaire():
    doc = SimpleDocTemplate(p("03_vendor_replies/1_shree_balaji_excel/SBC_Questionnaire_Reply.pdf"), pagesize=A4, leftMargin=18*mm, rightMargin=18*mm)
    s = [Paragraph("Shree Balaji Corrugators", H1), Paragraph("Quality questionnaire: SE-2026-041", H2)]
    rows = [["No.", "Question", "Reply"]] + [[q[0], Paragraph(q[1], P8), Paragraph(a, P8)] for q, a in zip(QUESTIONS, QA["SB"]["answers"])]
    t = Table(rows, colWidths=[12*mm, 85*mm, 77*mm]); t.setStyle(TableStyle([("FONT", (0, 0), (-1, -1), "DV", 8), ("GRID", (0, 0), (-1, -1), 0.3, colors.grey), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    s += [t, Spacer(1, 10), Paragraph(FICT, SMALL)]
    doc.build(s)

# ---------------------------------------------------------------- inbox cover emails
def inbox():
    mails = {
        "01_Shree_Balaji.eml": ("Sanjay Agarwal <sanjay@shreebalaji-corr.example>", "Wed, 1 Oct 2026 16:05:40 +0530", "Offer against SE-2026-041",
            "Dear Sir,\n\nPlease find attached our offer 0418 for your enquiry, along with the questionnaire reply, ISO certificate and test report.\nAll terms are in the T&C sheet.\n\nRegards,\nSanjay Agarwal\nShree Balaji Corrugators",
            ["SBC_Offer_0418_SE-2026-041.xlsx", "SBC_Questionnaire_Reply.pdf", "SB_ISO9001_Certificate_SAMPLE.pdf", "SB_Box_Test_Report_SAMPLE.pdf"]),
        "02_Vardhman.eml": ("Ritu Jain <exports@vardhmanpackwell.example>", "Thu, 2 Oct 2026 11:22:09 +0530", "Quotation VPE-Q-2611 | Sahyadri SE-2026-041",
            "Dear Mr. Deshpande,\n\nKindly find our quotation attached. Our questionnaire replies are on page 2. Certificates attached.\n\nWarm regards,\nRitu Jain\nVardhman Packwell Exports",
            ["Vardhman_Quotation_VPE-Q-2611.pdf", "VP_ISO9001_Certificate_SAMPLE.pdf", "VP_Box_Test_Report_SAMPLE.pdf"]),
        "03_Kaveri.eml": ("Prakash Kulkarni <sales@kaveripaper.example>", "Fri, 3 Oct 2026 12:40:55 +0530", "Quotation for corrugated boxes",
            "Respected Sir,\n\nPlease find our quotation letter attached.\n\nThanks & regards,\nPrakash Kulkarni",
            ["Kaveri_Quotation_SE-2026-041.docx", "KP_ISO9001_Certificate_SAMPLE.pdf", "KP_Box_Test_Report_SAMPLE.pdf"]),
        "04_Anand.eml": ("Anand Shinde <anandcartons.chakan@example.com>", "Fri, 3 Oct 2026 17:58:31 +0530", "rate list",
            "sir rate card photo attached. questionnaire also. 3 items we dont make.\nanand",
            ["Anand_RateCard_photo.jpg", "Anand_Questionnaire_reply.pdf", "AC_Box_Test_Report_SAMPLE.pdf"]),
        "05_Rohit.eml": ("Rohit Gaikwad <rohit.gaikwad@rohitbox.example>", "Fri, 3 Oct 2026 21:47:12 +0530", "Re: RFQ SE-2026-041 corrugated boxes",
            "(see 03_vendor_replies/5_rohit_email: the whole quote is in the email body)", []),
        "06_Shree_Balaji_revised.eml": ("Sanjay Agarwal <sanjay@shreebalaji-corr.example>", "Tue, 7 Oct 2026 10:12:03 +0530", "Revised offer 0418-R1",
            "Dear Vikram ji,\n\nAs discussed on call, please find our revised offer. Rates reduced on three items and validity extended to 60 days.\n\nRegards,\nSanjay",
            ["SBC_Offer_0418-R1_REVISED.xlsx"]),
    }
    for fn, (frm, date, subj, body, att) in mails.items():
        txt = f"From: {frm}\nTo: rfq-se2026041@sahyadri-appliances.example\nDate: {date}\nSubject: {subj}\n"
        if att: txt += "Attachments: " + ", ".join(att) + "\n"
        txt += "\n" + body + "\n"
        open(p("02_inbox/" + fn), "w").write(txt)

# ---------------------------------------------------------------- failure cases
def failures():
    good = open(p("03_vendor_replies/2_vardhman_pdf/Vardhman_Quotation_VPE-Q-2611.pdf"), "rb").read()
    open(p("05_failure_cases/F1_corrupt_quote.pdf"), "wb").write(good[: len(good) // 3])
    open(p("05_failure_cases/F2_not_a_quote.eml"), "w").write(
        "From: Deepak Mehta <deepak@mehtapack.example>\nTo: rfq-se2026041@sahyadri-appliances.example\nDate: Sat, 4 Oct 2026 09:15:00 +0530\n"
        "Subject: Re: RFQ SE-2026-041\n\nSir, received your enquiry. Our costing team is on leave, will send rates by next Monday.\n\nDeepak\nMehta Packaging (fictional)\n")
    open(p("05_failure_cases/F3_spam.eml"), "w").write(
        "From: Growth Team <offers@cheap-leads.example>\nTo: rfq-se2026041@sahyadri-appliances.example\nDate: Sat, 4 Oct 2026 02:01:00 +0530\n"
        "Subject: Get 10,000 B2B buyer leads today!!!\n\nDear Procurement Head, buy our verified database of buyers at 90% off. Click here.\n")
    # PDF with missing page: only page 1 of a 2-page quote
    doc = SimpleDocTemplate(p("05_failure_cases/F4_missing_page_quote.pdf"), pagesize=A4)
    rows = [["Line", "Item", "Rate INR/box"]] + [[l["id"], l["name"], f"{l['should_cost'] * 1.02:.2f}"] for l in LINES[:15]]
    t = Table(rows); t.setStyle(TableStyle([("FONT", (0, 0), (-1, -1), "DV", 8), ("GRID", (0, 0), (-1, -1), 0.3, colors.grey)]))
    doc.build([Paragraph("Deccan Box Works (fictional): quotation for SE-2026-041", H2), t,
               Paragraph("Continued on page 2...", P9), Paragraph("Page 1 of 2", SMALL), Paragraph(FICT, SMALL)])

if __name__ == "__main__":
    rfq(); sb_xlsx(1); sb_xlsx(2); vp_pdf(); kp_docx(); rb_email(); history()
    for v in ["SB", "VP", "KP"]:
        cert(v, "iso"); cert(v, "test")
    cert("AC", "test"); ac_questionnaire(); sb_questionnaire(); inbox(); failures()
    json.dump(SB_CODES, open(os.path.join(os.path.dirname(__file__), "sb_codes.json"), "w"))
    print("done")
