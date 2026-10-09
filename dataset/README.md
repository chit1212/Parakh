# Parakh demo dataset: SE-2026-041, corrugated boxes

Everything here is fictional: companies, people, certificate numbers and prices. Paper rates, conversion costs and the USD reference rate are demo assumptions.

## The scenario

Sahyadri Appliances (Plant 2, MIDC Chakan, Pune) is buying 30 lines of corrugated packaging for Oct 2026 to Mar 2027. Vikram Deshpande, the category buyer, sent the RFQ to five vendors. The award is worth about ₹4 crore. His VP, Meera Kulkarni, wants the award split cheapest per line, but only among vendors who cleared the quality questionnaire.

Basis for every comparison: price per box (per piece for accessories), in INR, delivered to Chakan, GST extra.

## Folders

| Folder | What is in it |
|---|---|
| 01_rfq | The RFQ the buyer sent (PDF) and the Excel template the vendors were asked to use |
| 02_inbox | The cover emails as they arrived in the event inbox, in order, including one revised quote |
| 03_vendor_replies | The five replies in five shapes, with questionnaire answers, certificates and test reports, plus the revised quote |
| 04_history | Last year's award (SE-2025-037) and Rohit Box's quote from last year, needed for "same as last year" |
| 05_failure_cases | Four files that should fail gracefully |
| 06_answer_key | The correct reading of every cell, the expected doubts and the expected scenario results |

## The five vendors and what is planted in each

| Vendor | Format | Planted edges |
|---|---|---|
| Shree Balaji Corrugators | Excel | Ignores the template: own item codes, own descriptions, grouped by ply, merged cells. Prices are ex-works; freight (₹0.35/box) is on a second sheet. A revised offer arrives later and changes three lines. Clears quality (84) |
| Vardhman Packwell Exports | 3-page PDF on letterhead | Quotes in USD. A 2.5% discount sits in a footnote on page 3 and applies only if a single PO exceeds ₹25 lakh. Questionnaire answers are on page 2. Clears quality (78) |
| Kaveri Paper Products | Word letter | Prices per 100 pieces, ex-works. All commercials are in one paragraph, including freight ₹0.40/box plus a 15% handling charge. L09 is written as ₹579 per 100 (₹5.79/box), far below should-cost, likely a typo. Clears quality (71) |
| Anand Cartons | Phone photo of a printed rate card, at an angle | No line IDs, so lines must be matched by name. Quotes 27 of 30 lines. Offers 3-ply on L14 where 5-ply was asked. L19 has a pen correction where the 1 looks like a 7. Fails quality (62, no ISO 9001, old test report) |
| Rohit Box Industries | One-line email | "₹42/kg for the 5-ply, 38 for the 3-ply, rest same as last year, freight extra." Box weights must be computed from the spec; 7-ply rate and printing come from last year's quote; freight is unknown. No questionnaire, so excluded from the quality scenario |

Also planted across the data:
- L21 changed from 5-ply to 7-ply this year, so it looks 73% above last year's price. That is explained, not an anomaly.
- L28 and L29 are new SKUs with no history.

## Should-cost (demo assumption)

Box weight = blank area × board GSM × 1.04. Should-cost = weight × ₹38.5/kg (3-ply), ₹42.5/kg (5-ply) or ₹45/kg (7-ply), plus printing at ₹0.12 + ₹0.25 per m² per colour. The value per line is in the answer key.

## Expected results (from 06_answer_key)

| Scenario | Total |
|---|---|
| Cheapest per line, all vendors | ₹4.01 crore |
| Cheapest per line, quality-cleared only (the VP's question) | ₹4.06 crore |
| Same, if Vardhman's discount applies | ₹4.00 crore |

Expected doubts that can change a winner: Vardhman's discount condition (11 lines), Rohit's missing freight (3 lines), Anand's 3-ply substitute on L14, Kaveri's L09 typo.
Expected doubt that should be logged but not escalated: Anand's L19 pen correction, because neither reading changes the winner.

## Failure cases

- F1: a corrupt PDF. Mark as unreadable and draft a resend request.
- F2: "will send rates by Monday." Not a quote; mark as pending.
- F3: spam. Ignore.
- F4: a PDF that shows page 1 of 2. Flag the missing page; don't treat it as a 15-line quote.
