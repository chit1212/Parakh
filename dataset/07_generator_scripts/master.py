"""Master data for the Parakh demo dataset.

All companies, people and documents are fictional. Paper rates and conversion
costs are demo assumptions, labelled as such in the README.
"""
import random

EVENT = {
    "id": "SE-2026-041",
    "title": "Corrugated boxes, FY27 H2",
    "buyer_co": "Sahyadri Appliances Pvt. Ltd.",
    "plant": "Plant 2, MIDC Chakan, Pune 410501",
    "buyer": "Vikram Deshpande",
    "buyer_role": "Category Buyer, Packaging",
    "buyer_email": "vikram.deshpande@sahyadri-appliances.example",
    "vp": "Meera Kulkarni",
    "vp_role": "VP, Procurement",
    "issued": "22 Sep 2026",
    "due": "03 Oct 2026",
    "ly_event": "SE-2025-037",
    "basis": "Price per box (or per piece for accessories), in INR, delivered to Plant 2 Chakan, GST extra",
}

# ply -> (board gsm, should-cost rate INR/kg)  [board gsm includes flute take-up]
BOARD = {
    "3-ply B": 150 + 120 + 120 * 1.32,
    "3-ply E": 150 + 120 + 120 * 1.27,
    "5-ply BC": 180 + 120 * 1.32 + 120 + 120 * 1.45 + 150,
    "7-ply BCB": 200 + 140 * 1.32 + 140 + 140 * 1.45 + 140 + 140 * 1.32 + 180,
}
PAPER_SPEC = {
    "3-ply B": "150/120/120 GSM, top 18 BF, flute B",
    "3-ply E": "150/120/120 GSM, top 18 BF, flute E",
    "5-ply BC": "180/120/120/120/150 GSM, top 20 BF, flutes B+C",
    "7-ply BCB": "200/140/140/140/140/140/180 GSM, top 22 BF, flutes B+C+B",
}
SHOULD_RATE = {"3": 38.5, "5": 42.5, "7": 45.0}  # INR per kg of box, demo assumption

# id, name, kind(RSC/acc), L, W, H (mm) or area m2 for accessories, ply, colours, qty
LINES_RAW = [
    ("L01", "Steam iron, unit carton", "RSC", 280, 140, 150, "3-ply E", 4, 60000),
    ("L02", "Steam iron, master carton (6 units)", "RSC", 450, 300, 440, "5-ply BC", 1, 10000),
    ("L03", "Dry iron, unit carton", "RSC", 260, 130, 140, "3-ply B", 2, 40000),
    ("L04", "Dry iron, master carton (8 units)", "RSC", 540, 270, 300, "5-ply BC", 1, 5000),
    ("L05", "Mixer grinder 750W, unit carton", "RSC", 380, 300, 420, "5-ply BC", 4, 35000),
    ("L06", "Mixer grinder, master carton (2 units)", "RSC", 610, 390, 430, "5-ply BC", 1, 17500),
    ("L07", "Juicer mixer, unit carton", "RSC", 420, 320, 450, "5-ply BC", 4, 12000),
    ("L08", "Hand blender, unit carton", "RSC", 300, 110, 90, "3-ply E", 4, 25000),
    ("L09", "Electric kettle 1.5L, unit carton", "RSC", 230, 200, 250, "3-ply B", 4, 30000),
    ("L10", "Electric kettle, master carton (6 units)", "RSC", 700, 420, 265, "5-ply BC", 1, 5000),
    ("L11", "Pop-up toaster, unit carton", "RSC", 330, 220, 230, "5-ply BC", 2, 15000),
    ("L12", "Induction cooktop, unit carton", "RSC", 380, 320, 120, "5-ply BC", 2, 20000),
    ("L13", "Table fan 400mm, unit carton", "RSC", 480, 200, 480, "5-ply BC", 2, 18000),
    ("L14", "Exhaust fan 250mm, unit carton", "RSC", 330, 170, 330, "5-ply BC", 1, 22000),
    ("L15", "Pedestal fan, unit carton", "RSC", 720, 210, 480, "5-ply BC", 2, 14000),
    ("L16", "Wall fan, unit carton", "RSC", 470, 200, 470, "5-ply BC", 2, 16000),
    ("L17", "Ceiling fan 1200mm, unit carton", "RSC", 520, 320, 210, "5-ply BC", 1, 45000),
    ("L18", "Ceiling fan, master carton (2 units)", "RSC", 660, 530, 330, "7-ply BCB", 1, 22500),
    ("L19", "Room heater 2000W, unit carton", "RSC", 420, 180, 510, "5-ply BC", 2, 9000),
    ("L20", "Water heater 15L, unit carton", "RSC", 400, 400, 480, "5-ply BC", 2, 11000),
    ("L21", "Water heater 25L, unit carton", "RSC", 460, 460, 560, "7-ply BCB", 2, 8000),
    ("L22", "Air cooler 40L, unit carton", "RSC", 540, 420, 1100, "7-ply BCB", 1, 4000),
    ("L23", "Rice cooker 1.8L, unit carton", "RSC", 330, 300, 300, "5-ply BC", 4, 10000),
    ("L24", "Sandwich maker, unit carton", "RSC", 290, 250, 120, "3-ply B", 4, 18000),
    ("L25", "Vegetable chopper, unit carton", "RSC", 180, 160, 220, "3-ply E", 4, 20000),
    ("L26", "Partition set, 6-cell, for kettle master", "ACC", 0.62, None, None, "3-ply B", 0, 5000),
    ("L27", "Layer pad 1000 x 1200 mm, for pallets", "ACC", 1.20, None, None, "5-ply BC", 0, 8000),
    ("L28", "Air fryer 4L, unit carton (new SKU)", "RSC", 360, 340, 380, "5-ply BC", 4, 15000),
    ("L29", "Air fryer, master carton (2 units) (new SKU)", "RSC", 740, 370, 400, "5-ply BC", 1, 7500),
    ("L30", "Mixer grinder, die-cut jar insert", "ACC", 0.21, None, None, "3-ply B", 0, 35000),
]
NEW_SKUS = {"L28", "L29"}
SPEC_CHANGED = {"L21": "Last year (SE-2025-037) this carton was 5-ply BC. Changed to 7-ply BCB this year after transit damage."}


def area_m2(r):
    _, _, kind, L, W, H, *_ = r
    if kind == "ACC":
        return L
    return ((2 * L + 2 * W + 35) * (W + H)) / 1e6


def build_lines():
    out = []
    for r in LINES_RAW:
        lid, name, kind, L, W, H, ply, col, qty = r
        a = area_m2(r)
        wt = a * BOARD[ply] / 1000 * 1.04
        plyn = ply[0]
        print_cost = col * (0.12 + 0.25 * a) if col else 0.0
        diecut = 0.15 if lid == "L30" else 0.0
        sc = wt * SHOULD_RATE[plyn] + print_cost + diecut
        size = f"{L} x {W} x {H} mm (internal)" if kind == "RSC" else f"{L:.2f} m2 board area"
        spec = f"{ply}, {PAPER_SPEC[ply]}, " + (f"{col}-colour flexo print" if col else "unprinted")
        qty = int(round(qty * 2.6 / 500.0)) * 500
        out.append(dict(id=lid, name=name, kind=kind, size=size, ply=ply, ply_n=int(plyn), colours=col,
                        qty=qty, area_m2=round(a, 4), weight_kg=round(wt, 3), spec=spec,
                        should_cost=round(sc, 2)))
    return out


LINES = build_lines()

VENDORS = [
    dict(id="SB", name="Shree Balaji Corrugators", city="Bhosari MIDC, Pune", contact="Sanjay Agarwal",
         email="sanjay@shreebalaji-corr.example", fmt="Excel", factor=1.005),
    dict(id="VP", name="Vardhman Packwell Exports", city="Ranjangaon MIDC, Pune", contact="Ritu Jain",
         email="exports@vardhmanpackwell.example", fmt="PDF", factor=1.0),
    dict(id="KP", name="Kaveri Paper Products", city="Talegaon Dabhade, Pune", contact="Prakash Kulkarni",
         email="sales@kaveripaper.example", fmt="Word", factor=1.02),
    dict(id="AC", name="Anand Cartons", city="Chakan, Pune", contact="Anand Shinde",
         email="anandcartons.chakan@example.com", fmt="Photo", factor=0.985),
    dict(id="RB", name="Rohit Box Industries", city="Shikrapur, Pune", contact="Rohit Gaikwad",
         email="rohit.gaikwad@rohitbox.example", fmt="Email", factor=None),
]

USD_RATE = 88.20          # reference rate shown to the buyer, demo assumption, dated 01 Oct 2026
SB_FREIGHT = 0.35         # INR per box, stated on SB's Terms sheet
KP_FREIGHT = 0.40         # INR per box, plus 15% handling hidden in the paragraph
KP_HANDLING = 0.15
VP_DISCOUNT = 0.025       # applies only if a single PO exceeds INR 25 lakh
RB_RATE = {3: 38.0, 5: 42.0}
RB_LY = {3: 36.0, 5: 40.0, 7: 44.0, "print_per_colour": 0.20}
AC_MISSING = {"L07", "L22", "L30"}
AC_SUB_LINE = "L14"       # Anand offers 3-ply B instead of 5-ply BC
AC_HAND_LINE = "L19"      # printed rate struck out, pen-written 31.20 whose 1 looks like a 7 (37.20). True intent 31.20
KP_TYPO_LINE = "L09"      # written 579.00 per 100 (= 5.79/box), far below should-cost


def r2(x):
    return round(x + 1e-9, 2)


def build_prices():
    rnd = random.Random(41)
    P = {}
    for v in VENDORS:
        P[v["id"]] = {}
        for l in LINES:
            noise = rnd.uniform(0.955, 1.045)
            if v["id"] == "RB":
                if l["ply_n"] == 7:
                    rate = RB_LY[7]
                else:
                    rate = RB_RATE[l["ply_n"]]
                p = l["weight_kg"] * rate + l["colours"] * RB_LY["print_per_colour"] + (0.15 if l["id"] == "L30" else 0)
                P["RB"][l["id"]] = r2(p)   # freight not included, unknown
            else:
                P[v["id"]][l["id"]] = r2(l["should_cost"] * v["factor"] * noise)
    # Anand substitute: price for 3-ply version of L14
    l14 = next(l for l in LINES if l["id"] == "L14")
    wt3 = l14["area_m2"] * BOARD["3-ply B"] / 1000 * 1.04
    P["AC"]["L14"] = r2((wt3 * SHOULD_RATE["3"] + 1 * (0.12 + 0.25 * l14["area_m2"])) * 0.97)
    return P


PRICES = build_prices()   # true delivered INR/box, ex-GST (RB: ex-freight)
AC_L19_PRINTED = PRICES["AC"]["L19"]
PRICES["AC"]["L19"] = 31.20

# Shree Balaji revised quote v2: three lines reduced after the buyer's call
SB_V2_CHANGES = {"L05": 0.965, "L11": 0.96, "L24": 0.97}

# Last year's (SE-2025-037) awarded prices, for 28 lines (no history for new SKUs)
def build_ly():
    rnd = random.Random(37)
    ly = {}
    for l in LINES:
        if l["id"] in NEW_SKUS:
            continue
        base = l["should_cost"]
        if l["id"] in SPEC_CHANGED:      # last year it was 5-ply: lighter, cheaper
            a = l["area_m2"]
            base = a * BOARD["5-ply BC"] / 1000 * 1.04 * SHOULD_RATE["5"] + l["colours"] * (0.12 + 0.25 * a)
        ly[l["id"]] = dict(price=r2(base * 0.95 * rnd.uniform(0.98, 1.02)),
                           vendor=rnd.choice(["Shree Balaji Corrugators", "Kaveri Paper Products", "Rohit Box Industries"]))
    return ly


LY = build_ly()

QUESTIONS = [
    ("Q1", "Valid ISO 9001 certificate (attach copy)", "Mandatory"),
    ("Q2", "Box compression or bursting strength test report from the last 12 months (attach)", "Mandatory"),
    ("Q3", "Monthly capacity in tonnes of finished boxes", "Scored"),
    ("Q4", "Standard lead time from PO to delivery, in days", "Scored"),
    ("Q5", "Rejection rate at customer end in the last 12 months (%)", "Scored"),
    ("Q6", "Moisture-resistant (wax or water-based coating) option available?", "Scored"),
    ("Q7", "Share of recycled fibre, and FSC certification if any", "Scored"),
    ("Q8", "Two current customer references in consumer durables", "Scored"),
]
QA = {
    "SB": dict(returned=True, score=84, iso=True, test_date="12 Jun 2026", answers=[
        "Yes, ISO 9001:2015, certificate no. DQC/QMS/22417, valid to 14 Mar 2028",
        "Yes, BCT and bursting test report dated 12 Jun 2026 (attached)",
        "620 tonnes per month", "10 days", "0.6%", "Yes, water-based coating", "60% recycled fibre; FSC not certified",
        "Two named appliance makers in Pune (attached)"]),
    "VP": dict(returned=True, score=78, iso=True, test_date="28 Apr 2026", answers=[
        "Yes, ISO 9001:2015, certificate no. DQC/QMS/19870, valid to 30 Nov 2027",
        "Yes, bursting strength report dated 28 Apr 2026",
        "900 tonnes per month", "14 days", "0.9%", "Yes, wax coating", "45% recycled fibre; FSC chain of custody",
        "References available on request"]),
    "KP": dict(returned=True, score=71, iso=True, test_date="05 Feb 2026", answers=[
        "Yes, ISO 9001:2015, certificate no. DQC/QMS/24102, valid to 09 Jan 2027",
        "Yes, bursting strength report dated 05 Feb 2026",
        "310 tonnes per month", "12 days", "1.4%", "No", "70% recycled fibre", "One reference given"]),
    "AC": dict(returned=True, score=62, iso=False, test_date="18 Jan 2025", answers=[
        "ISO 9001 audit planned for Dec 2026", "Test report dated 18 Jan 2025 (attached)",
        "140 tonnes per month", "7 days", "2.1%", "Yes, on request", "80% recycled fibre",
        "Local customers in Chakan, names on request"]),
    "RB": dict(returned=False, score=None, iso=None, test_date=None, answers=None),
}
PASS_RULE = "Questionnaire returned, score 70 or more, and both mandatory items (Q1 ISO 9001, Q2 test report within 12 months) passed"
