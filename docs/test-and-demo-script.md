# Parakh: end-to-end test and demo video script

Live link: https://parakh-ten.vercel.app
Every number below is what the app computes from the saved readings (read on 9 Oct 2026). If you upload files or ask the chat in your own words, wording can differ. Numbers that come from code should match exactly.

---

## Part 1. Before you start (2 minutes)

1. Use Chrome on a laptop. Set the window to at least 1280 px wide (full screen is fine).
2. Open https://parakh-ten.vercel.app/events/SE-2026-041/compare.
3. Click **P** (top of the left rail). Under **Reset demo**, click **Back to the full demo (five replies read)**, then **Reset**. This clears your old approvals, decisions and chat in this browser.
4. Check that you are **Vikram · buyer**: P menu → Demo: view as → Vikram.

---

## Part 2. End-to-end test checklist (about 25 minutes)

Tick each line. If something differs, note the step number, what you expected, what you saw, and take a screenshot.

### A. Compare opens on the VP's view
| # | Do | Expect |
|---|---|---|
| A1 | Look at the top of Compare | The **Start here** strip has 3 numbered actions. Scenario: **Cheapest per line, quality-cleared only**. |
| A2 | Read the summary row | **Award total · quality-cleared vendors ₹4.06 Cr**. Benchmark line: **as quoted, all vendors ₹4.01 Cr**, which includes Anand and Rohit Box, who can't be awarded. **vs as quoted: +₹5.01 L** (₹4,05,78,360 vs ₹4,00,77,050). |
| A3 | Read the doubts box | **2 · ₹3.62 L**, and "14 more checked and logged, none changes a winner". The tab says **Doubts 2**. |
| A4 | Click **Rules: 2 vendors excluded · Show** | Rules R1–R5, plus Anand (scored 20, no ISO 9001, old test report) and Rohit Box (questionnaire not returned). |
| A5 | Look at the vendor headers | Badges: ✓ Quality 90/100, 80/100, 70/100; Anand **✕ Quality 20/100** (solid magenta); Rohit Box **Quality: not returned** and **Freight pending**. |
| A6 | Hover the **‡** under Vardhman | Tooltip: prices are shown *without* the 2.5% discount, which applies only if a single PO exceeds ₹25 lakh; monthly POs are ₹15–30 L; Doubt 2. |
| A7 | Look at the Vardhman column | A magenta **?** only on lines where the discount would change the winner in this scenario (11 lines), not on all 30. |

### B. Trace any number (the most important interaction)
| # | Do | Expect |
|---|---|---|
| B1 | Start here → **1 Click any price…** | The first price with a doubt pulses. The right panel switches to **Source**, showing the original file with the row or cell highlighted. |
| B2 | Click a **Shree Balaji** price (e.g. L05) | The Excel sheet with the cell outlined. Assurance: **Matched to source**. The sum shows freight added. |
| B3 | Click a **Vardhman** price | The PDF row is highlighted. USD × ₹88.20 (reference rate, with its date). |
| B4 | Click **Anand L19** (37.20) | The photo with the row boxed. As written: **37.20** in bold (in use) and **31.20** struck through ("code's other reading"). The note says "Logged. It doesn't change a winner in this scenario." Assurance: **Read by AI**, because a photo can't be matched by code. |
| B5 | Hover any Anand L19 cell | Tooltip: "Two readings: ₹37.20 · ₹31.20 (hand-corrected). Using ₹37.20. Logged." |
| B6 | Click **Anand** (the vendor name in the header) | "How this score was worked out": 8 questions with answers, points, and Pass/Fail on the mandatory items. Total 20/100, pass mark 70, mandatory 0/2 → Not cleared. Click an answer to see it in his document. |
| B7 | Click a winning price → **Approve this price** | The seal icon appears on the cell, and the header counter shows 1/30 approved. |

### C. Switch the view
| # | Do | Expect |
|---|---|---|
| C1 | Scenario → **As quoted — cheapest per line, all vendors** | The total is **₹4.01 Cr** with a **Provisional** tag and a dashed outline: "8 lines won by Rohit Box exclude freight". Doubts: **4 · ₹9.33 L**. Rohit Box prices carry **+F**. |
| C2 | Click **Chart** | Four charts: Scenario cost vs baseline, Supplier share, Biggest increases vs last year (L21 first, about +₹9.08 L), Doubts ranked by ₹ at stake. |
| C3 | Switch the scenario back to quality-cleared | The charts follow it, and Chart stays selected. |
| C4 | Click **≫** on the right panel | The inspector collapses. Reload the page: it stays collapsed. Click **≪** to reopen it. |

### D. Ask the analyst (live AI; each answer takes about 5–15 seconds)
Ask these in the chat box (or use Start here → 3 for the first one).

| # | Ask | Expect (numbers are computed in code) |
|---|---|---|
| D1 | **Start here → 3** (asks as Meera, the VP) | "Cheapest per line, quality-cleared only costs ₹5.01 L more than as quoted, all vendors. Total ₹4,05,78,360." Shares SB 44.0% / VP 45.5% / KP 10.5%. A scenario card tagged **Proven cheapest**. |
| D2 | "Among quality-cleared vendors, what are the five biggest contributors to the increase over last year?" | Net **+₹18.54 L on 28 lines**; the top 5 add **₹13.80 L**. Ranked magenta bars starting with **L21 +₹9.08 L**. The chip reads "Same data as the Compare table · 28 lines have last year's price". |
| D3 | "Cheapest split among cleared vendors, no vendor above 37%." | **Compared with: Cheapest per line, quality-cleared only**. It costs **₹1.50 L more**, total **₹4,07,28,770**. Shares SB 37.0% · VP 35.7% · KP 27.3%, with a cap line on the bars. **Proven cheapest**, and "Self-check passed". |
| D4 | On D3's answer, change **Compared with** to "As quoted, all vendors" | The lead and bars recompute against ₹4.01 Cr. |
| D5 | "Two vendors only?" | A two-vendor scenario. Its rules show the vendor pairs tried and the best pair. |
| D6 | "Where did Kaveri's L09 price come from?" | Rs 579.00 per 100 pcs, the source sentence in the Word file, and the conversion. |
| D7 | Click **Show working** under any answer | The AI's full explanation, rules, eligibility per vendor, every line that moves, and solver notes. |

### E. Decide the doubts, then try to submit
| # | Do | Expect |
|---|---|---|
| E1 | Click **Save draft award** *before* deciding anything | The Award screen shows the 4-step bar on **Draft**, a pink **Can't submit yet** box (Doubt 2, Doubt 3, unapproved prices on doubt lines), and **Send to Meera for approval** greyed out. |
| E2 | Back to Compare → **Doubts** tab | "Can change a winner here · 2" (pink rows) and "Don't affect this scenario · 2", each with a reason (Anand / Rohit Box not eligible here). |
| E3 | Open **Vardhman's 2.5% discount**. Choose **Award without the discount: don't count on it**, type a reason, click **Record decision** | The decision shows your name and the time. |
| E4 | Open **Kaveri L09**. Choose **Approve the price as written** or **Hold it**, type a reason, click **Record decision** | The tab count drops to **Doubts 0**. If you approved it, Kaveri's ₹6.25 can now win L09. |
| E5 | **Save draft award** again | The bar shows **In review**, there's no blocker box, and **Send to Meera for approval** is enabled. |
| E6 | Click **Send to Meera for approval** | The bar shows **Submitted**. (Sending is stubbed; nothing leaves the app.) |
| E7 | P menu → view as **Meera · VP** | The button reads **Approve award**. Click it: the bar shows **Approved**, with "Approved by Meera Kulkarni". |
| E8 | Open **Approvals, decisions and overrides** | Every approval and decision, with who, when and why. |
| E9 | Click **Excel** and **PDF memo** | Both download and open; the Excel file has an Audit trail sheet. |

### F. Replies and uploads
| # | Do | Expect |
|---|---|---|
| F1 | Open **Replies** | The intro line reads "Typed files are matched to the source by code. Photo readings need your check." The cards show **5 of 5** replied and **147 of 150** prices read. |
| F2 | Read the rows | Each shows an assurance count, e.g. Vardhman "0 AI only · 30 matched · 0 approved" and Anand "27 AI only". Needs you: Vardhman's discount message, Anand's L14, and Rohit Box's freight. |
| F3 | Click the arrow on a row | The file, price basis as read, quality documents, Open original, See what was read, and Read again live. |
| F4 | *(Optional, uses live AI)* **Upload a reply** → pick a file from `test-round-1/` → **Read it** | Progress steps, then the reply joins the comparison. |

### G. Empty event (optional, about 10 minutes, live AI)
P → Reset demo → **Start empty**. Then upload the five folders from `test-round-1/` on Replies, one at a time. After all five, Compare should match section A, give or take small reading differences.

**When you finish testing:** tell Claude to set the AI limit back to 12 an hour and 150 a day.

---

## Part 3. Demo video script (about 6 minutes)

**Set-up before recording**
- Reset the demo (Part 1), signed in as Vikram. Browser at 1440 × 900 or full screen, zoom 100%.
- Close other tabs, and hide bookmarks (Ctrl/Cmd+Shift+B).
- Do one dry run of the chat question so the AI is warm, then reset again.
- Record with Loom, or QuickTime on a Mac (File → New Screen Recording) or the Xbox Game Bar on Windows (Win+Alt+R).

**Recording.** Say the "Say" lines; do the "Do" lines.

**0:00 – 0:30 · The problem**
- Do: open on Compare, with the Start here strip visible.
- Say: "Buyers retype vendor quotes into a spreadsheet because they care about accuracy more than time. Parakh keeps the accuracy and removes the retyping. AI reads, code calculates, independent checks verify, and the buyer decides."

**0:30 – 1:10 · Five formats, one table**
- Do: point at the five vendor columns, then open **Replies** for five seconds and come back.
- Say: "Five vendors replied in five formats: Excel, a PDF in dollars, a Word letter priced per hundred, a phone photo, and a one-line email. Parakh reads every reply into one basis: rupees per box, delivered, GST extra. Typed files are matched to the source by code; photo readings need my check."

**1:10 – 2:10 · Click any number**
- Do: Start here → **1**. Then click a Vardhman price, then **Anand L19**.
- Say: "Every number traces back to where it came from. Here is the exact row in Vardhman's PDF, converted from dollars at a dated reference rate. This one is from a phone photo, with a pen correction: it could be 37.20 or 31.20. Code tested both readings, and neither changes a winner, so it is logged, not raised. Photos stay marked 'read by AI' until I check them."

**2:10 – 2:50 · Only the doubts that matter**
- Do: hover the **‡**, then open the **Doubts** tab and point at the two groups.
- Say: "Parakh checked fourteen more things and logged them. It only interrupts me when a doubt could change who wins, in the scenario I'm looking at. Vardhman's discount only applies above ₹25 lakh per order, so it shows once in the header and gets a question mark only on the eleven lines where it would flip the winner."

**2:50 – 4:00 · The VP's question**
- Do: Start here → **3**. Wait for the answer, open **Show working** briefly, then ask: "Cheapest split among cleared vendors, no vendor above 37%."
- Say: "Meera, our VP, asks the brief's question: split it, cheapest per line, only among vendors who cleared quality. The AI picks the rules; code solves them. ₹4.06 crore, five lakh more than the all-vendor benchmark, with exact shares. Now a 37% cap: it's solved exactly, the card says 'Proven cheapest', and it states the baseline it compares against. The AI never does the maths."

**4:00 – 4:30 · Charts**
- Do: click **Chart**.
- Say: "The same numbers as charts: what each scenario costs against the baseline, supplier shares against the cap, the five biggest increases over last year, and the doubts ranked by rupees."

**4:30 – 5:40 · Decide and submit**
- Do: **Save draft award** → show the **Can't submit yet** box → back to **Doubts** → record decisions on the discount and Kaveri L09 → **Save draft award** → **Send to Meera** → switch to Meera in the P menu → **Approve award** → open the audit list → click **PDF memo**.
- Say: "The award can't go to the VP while a doubt could still change a winner. I record my decisions, with a reason, and the draft moves to In review. I send it to Meera, and she approves. Every approval and decision is on the record with who, when and why, and the memo exports with it."

**5:40 – 6:00 · Close**
- Do: return to Compare.
- Say: "The buyer only touches the numbers that matter. Everything else is read, converted, checked and logged, and every number can be traced back to its source."

**After recording:** reset the demo so the live link is clean for reviewers.
