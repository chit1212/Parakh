"""Ground truth for the dataset, computed from the same numbers that were written into the files."""
import os, json
import openpyxl, docx
from master import *

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))
OUT = os.path.join(ROOT, "06_answer_key")
Lmap = {l["id"]: l for l in LINES}
cells = {}

# Shree Balaji: read back what was written, both versions
def read_sb(path):
    ws = openpyxl.load_workbook(path)["Offer"]
    rows = {}
    desc2id = {l["name"].replace(", unit carton", " box").replace("carton", "ctn").upper(): l["id"] for l in LINES}
    for r in ws.iter_rows(min_row=7):
        if r[1].value and str(r[1].value).startswith("CB-"):
            rows[desc2id[r[2].value]] = (r[6].value, f"sheet Offer, cell G{r[6].row}")
    return rows
sb1 = read_sb(os.path.join(ROOT, "03_vendor_replies/1_shree_balaji_excel/SBC_Offer_0418_SE-2026-041.xlsx"))
sb2 = read_sb(os.path.join(ROOT, "03_vendor_replies/6_revised_quote/SBC_Offer_0418-R1_REVISED.xlsx"))
for lid, (exw, loc) in sb2.items():
    flags = ["ex-works price; freight Rs 0.35/box is on the T&C sheet, cell B3"]
    if lid in SB_V2_CHANGES:
        flags.append(f"revised in R1 (was {sb1[lid][0]:.2f} ex-works in offer 0418)")
    cells[("SB", lid)] = dict(as_written=f"Rs {exw:.2f}/pc ex-works", source=f"SBC_Offer_0418-R1_REVISED.xlsx, {loc}",
                              normalised=r2(exw + SB_FREIGHT), calc=f"{exw:.2f} + 0.35 freight", flags=flags)

# Vardhman: USD per box
for l in LINES:
    usd = round(PRICES["VP"][l["id"]] / USD_RATE, 4)
    inr = r2(usd * USD_RATE)
    cells[("VP", l["id"])] = dict(as_written=f"USD {usd:.4f}/box delivered", source=f"Vardhman_Quotation_VPE-Q-2611.pdf, page 1, row {l['id']}",
                                  normalised=inr, calc=f"{usd:.4f} x {USD_RATE} (reference rate, 01 Oct 2026; vendor invoices at invoice-date rate)",
                                  with_conditional_discount=r2(inr * (1 - VP_DISCOUNT)),
                                  flags=["quoted in USD", "2.5% discount in footnote on page 3 applies only if a single PO exceeds Rs 25 lakh"])

# Kaveri: per 100 pcs ex-works, freight 0.40 + 15% handling
d = docx.Document(os.path.join(ROOT, "03_vendor_replies/3_kaveri_word/Kaveri_Quotation_SE-2026-041.docx"))
for row in d.tables[0].rows[1:]:
    lid = row.cells[0].text; per100 = float(row.cells[4].text.replace(",", ""))
    fr = r2(KP_FREIGHT * (1 + KP_HANDLING))
    flags = ["priced per 100 pieces", "ex-works; freight Rs 0.40/box plus 15% handling is in the commercial paragraph"]
    if lid == KP_TYPO_LINE:
        flags.append("OUT OF RANGE: Rs 5.79/box is about 25% below should-cost for this spec. Likely a typo. Must be confirmed by the vendor before it can win the line")
    cells[("KP", lid)] = dict(as_written=f"Rs {per100:,.2f} per 100 pcs ex-works", source=f"Kaveri_Quotation_SE-2026-041.docx, table 1, row {lid}",
                              normalised=r2(per100 / 100 + fr), calc=f"{per100:.2f} / 100 + 0.40 x 1.15", flags=flags)

# Anand: photo
n = 0
for l in LINES:
    if l["id"] in AC_MISSING:
        cells[("AC", l["id"])] = dict(as_written="not quoted", source="Anand_RateCard_photo.jpg, footnote 'We do not make'", normalised=None, calc=None,
                                      flags=["not quoted (27 of 30 lines)"])
        continue
    n += 1
    f = []
    p = PRICES["AC"][l["id"]]
    if l["id"] == AC_SUB_LINE:
        f.append("ALTERNATE: quoted 3-ply where 5-ply BC was asked. Not comparable; buyer must accept or reject the substitute")
    if l["id"] == AC_HAND_LINE:
        f.append(f"HANDWRITTEN: printed {AC_L19_PRINTED:.2f} is struck out; pen value reads 31.20 but the 1 looks like a 7 (37.20). Confirm with vendor")
    cells[("AC", l["id"])] = dict(as_written=f"Rs {p:.2f}/pc delivered", source=f"Anand_RateCard_photo.jpg, row {n}", normalised=p, calc="as written", flags=f)

# Rohit: per kg
for l in LINES:
    rate = RB_LY[7] if l["ply_n"] == 7 else RB_RATE[l["ply_n"]]
    src = "last year's rate (SE-2025-037, Rohit Box quote sheet), via 'rest same as last year'" if l["ply_n"] == 7 else "email body"
    pr = l["colours"] * RB_LY["print_per_colour"] + (0.15 if l["id"] == "L30" else 0)
    val = r2(l["weight_kg"] * rate + pr)
    f = ["priced per kg; box weight computed from the RFQ spec", "freight extra, amount not given (last year it was Rs 0.30/box)"]
    if l["ply_n"] == 7:
        f.append("7-ply rate resolved from last year's quote")
    if pr:
        f.append("printing and die-cutting at last year's rates")
    cells[("RB", l["id"])] = dict(as_written=f"Rs {rate:.0f}/kg" + (" (last year)" if l["ply_n"] == 7 else ""), source=f"Re_RFQ_SE-2026-041.eml, {src}",
                                  normalised=val, calc=f"{l['weight_kg']:.3f} kg x {rate:.0f} + {pr:.2f} print", flags=f,
                                  with_ly_freight=r2(val + 0.30))

# ---------------- scenarios
def solve(vendors, override=None):
    override = override or {}
    per = {}; total = 0
    for l in LINES:
        best = None
        for v in vendors:
            c = cells[(v, l["id"])]
            val = override.get((v, l["id"]), c["normalised"])
            if val is None or (v == "AC" and l["id"] == AC_SUB_LINE and (v, l["id"]) not in override):
                continue
            if v == "KP" and l["id"] == KP_TYPO_LINE and (v, l["id"]) not in override:
                continue
            if best is None or val < best[1]:
                best = (v, val)
        per[l["id"]] = best; total += best[1] * l["qty"]
    return per, round(total)

ALL = ["SB", "VP", "KP", "AC", "RB"]; QUAL = ["SB", "VP", "KP"]
base, base_t = solve(ALL)
qual, qual_t = solve(QUAL)
disc = {("VP", l["id"]): cells[("VP", l["id"])]["with_conditional_discount"] for l in LINES}
qual_d, qual_dt = solve(QUAL, disc)
rbf = {("RB", l["id"]): cells[("RB", l["id"])]["with_ly_freight"] for l in LINES}
base_f, base_ft = solve(ALL, rbf)
sub = {("AC", AC_SUB_LINE): cells[("AC", AC_SUB_LINE)]["normalised"]}
base_s, _ = solve(ALL, sub)
kp_typo = {("KP", KP_TYPO_LINE): cells[("KP", KP_TYPO_LINE)]["normalised"]}
qual_k, _ = solve(QUAL, kp_typo)
ac37 = {("AC", AC_HAND_LINE): 37.20}
base_37, _ = solve(ALL, ac37)

def changed(a, b):
    return [k for k in a if a[k][0] != b[k][0]]

doubts = [
    dict(id="D1", title="Vardhman's 2.5% discount applies only if a single PO exceeds Rs 25 lakh",
         why="Footnote on page 3. The RFQ says monthly POs per vendor run Rs 15-30 lakh, so whether it applies depends on how the award is split and how POs are raised.",
         route="vendor", lines_that_change_in_quality_scenario=changed(qual, qual_d)),
    dict(id="D2", title="Rohit Box: freight extra, amount not given",
         why="Rohit wins lines in the cheapest-overall view only before freight. Last year's freight was Rs 0.30/box.",
         route="vendor", lines_that_change_if_ly_freight_added=changed(base, base_f)),
    dict(id="D3", title="Anand offered 3-ply on L14 where 5-ply was asked", why="If accepted, Anand wins L14 at a much lower price.",
         route="buyer (judgement)", lines_that_change_if_accepted=changed(base, base_s)),
    dict(id="D4", title="Kaveri L09 at Rs 5.79/box is far below should-cost", why="Looks like a typo in the per-100 rate. If real, Kaveri wins L09 in the quality scenario.",
         route="vendor", lines_that_change_if_accepted=changed(qual, qual_k)),
    dict(id="D5", title="Anand L19 handwritten correction: 31.20 or 37.20?", why="Ambiguous pen digit.",
         route="vendor", lines_that_change_if_37_20=changed(base, base_37),
         expected_behaviour="Should be logged, not escalated: neither reading changes who wins L19."),
]
logged_not_escalated = [
    "Kaveri per-100 to per-box conversion (deterministic)",
    "Shree Balaji ex-works plus Rs 0.35 freight from the T&C sheet",
    "Shree Balaji revised offer R1 supersedes 0418 for L05, L11, L24",
    "Vardhman USD converted at the reference rate Rs 88.20 (01 Oct 2026)",
    "Rohit Box 7-ply rate and printing resolved from last year's quote",
    "L21 is 73% above last year's price because it changed from 5-ply to 7-ply (explained, not an anomaly)",
    "Anand did not quote L07, L22, L30",
]

key = dict(event=EVENT, basis=EVENT["basis"], usd_reference_rate=USD_RATE,
           lines=LINES,
           questionnaire=dict(pass_rule=PASS_RULE, results={v: {k: QA[v][k] for k in ("returned", "score", "iso", "test_date")} for v in QA},
                              cleared=QUAL, excluded={"AC": "scored 62; no ISO 9001; test report dated 18 Jan 2025 (older than 12 months)",
                                                      "RB": "questionnaire not returned (replied by email only)"}),
           cells={f"{v}|{l}": c for (v, l), c in cells.items()},
           scenarios={
               "cheapest_overall_all_vendors": dict(total_inr=base_t, winners={k: v[0] for k, v in base.items()}),
               "cheapest_per_line_quality_cleared": dict(total_inr=qual_t, winners={k: v[0] for k, v in qual.items()}),
               "quality_cleared_if_vardhman_discount_applies": dict(total_inr=qual_dt, winners={k: v[0] for k, v in qual_d.items()}),
               "all_vendors_with_rohit_ly_freight": dict(total_inr=base_ft, winners={k: v[0] for k, v in base_f.items()}),
           },
           expected_doubts=doubts, expected_logged_not_escalated=logged_not_escalated,
           exclusions_from_winning_by_default=["AC L14 alternate (3-ply) until the buyer accepts it", "KP L09 out-of-range until the vendor confirms"],
           failure_cases={"F1_corrupt_quote.pdf": "truncated PDF; should be marked unreadable and a resend request drafted",
                          "F2_not_a_quote.eml": "vendor says rates will come Monday; not a quote, mark as pending, no prices",
                          "F3_spam.eml": "not related to the RFQ; ignore",
                          "F4_missing_page_quote.pdf": "only page 1 of 2 (15 lines); flag missing page, do not treat as 15 of 30 quoted without asking"})
json.dump(key, open(os.path.join(OUT, "answer_key.json"), "w"), indent=2, ensure_ascii=False)

# Excel version for humans
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Normalised grid"
ws.append(["Line", "Item", "Qty", "Should-cost"] + [v["name"] for v in VENDORS])
for l in LINES:
    ws.append([l["id"], l["name"], l["qty"], l["should_cost"]] + [cells[(v["id"], l["id"])]["normalised"] for v in VENDORS])
ws2 = wb.create_sheet("Every cell")
ws2.append(["Vendor", "Line", "As written", "Source", "Normalised INR/box delivered ex-GST", "Calculation", "Flags"])
for (v, lid), c in cells.items():
    ws2.append([v, lid, c["as_written"], c["source"], c["normalised"], c["calc"], "; ".join(c["flags"])])
ws3 = wb.create_sheet("Scenarios")
ws3.append(["Line"] + list(key["scenarios"].keys()))
for l in LINES:
    ws3.append([l["id"]] + [key["scenarios"][s]["winners"][l["id"]] for s in key["scenarios"]])
ws3.append(["Total INR"] + [key["scenarios"][s]["total_inr"] for s in key["scenarios"]])
ws4 = wb.create_sheet("Doubts")
ws4.append(["ID", "Doubt", "Why", "Route", "Lines affected"])
for dd in doubts:
    affected = [v for k, v in dd.items() if k.startswith("lines")][0]
    ws4.append([dd["id"], dd["title"], dd["why"], dd["route"], ", ".join(affected) or "none"])
for s in wb.worksheets:
    for col in "ABCDEFGHIJ":
        s.column_dimensions[col].width = 22
wb.save(os.path.join(OUT, "answer_key.xlsx"))

print("base", base_t, "qual", qual_t, "qual+disc", qual_dt, "base+freight", base_ft)
for dd in doubts:
    print(dd["id"], [v for k, v in dd.items() if k.startswith("lines")][0])
