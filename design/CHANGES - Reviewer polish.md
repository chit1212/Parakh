# Change request: reviewer polish (Compare screen)

**Audience:** reviewers who spend about 2 minutes on the live site.
**Scope:** the Compare screen, its chat, the Doubts tab, the vendor popover and the source panel.
**Styling:** follow the Broadsheet tokens and the v2 rules in `README.md`.
**Numbers:** every number below must come from the same data the app already computes. Do not hard-code any of them.

---

## 1. "Start here" strip (dismissible)

**Where:** a full-width strip directly under the Compare header, above the key-number cards.

**Look:**
- One line high (about 44 px), wrapping to two lines on narrow screens.
- bg `--color-accent-100`, radius `--radius-lg`, padding 10 × 16, no shadow.
- Text is 15 px.

**Content, left to right:**
1. **"Start here"** (600), then the line: "Five vendor replies in five formats, read into one comparison you can check."
2. Three numbered actions as accent-700 text buttons. Each has a 20 px circled numeral (1, 2, 3) in accent fill with white text. Gap between items: 20 px.

| # | Label | Action on click |
|---|---|---|
| 1 | Click any price to see where it came from | Select the current winner of the first line (or the first doubt cell if there is one) and switch the right panel to **Source**. Pulse a 2 px accent ring on that cell for 1.2 s. |
| 2 | Open Doubts: only the 4 that could change a winner | Switch to the **Doubts** tab. The count comes from `doubts.length`, never hard-coded. |
| 3 | Ask the VP's question in the chat | Switch the right panel to **Conversation** and send the preset VP question as Meera · VP (the same question the "quality-cleared only" scenario answers). The answer and scenario card appear as usual. |

**Behaviour:**
- Dismiss with a ghost × icon button at the far right (`aria-label="Dismiss"`).
- Persist the dismissal in `localStorage['parakh-start-dismissed'] = '1'`.
- Show a done tick on each item once its action has been triggered. The strip stays until it is dismissed.
- "Reset demo" in the P menu clears the key so the strip shows again.

---

## 2. Default scenario = "Cheapest per line, quality-cleared only"

- **On load:** the Compare screen opens with scenario `S1` ("Cheapest per line, quality-cleared only") active. Total is **₹4.06 Cr** (computed).
- **Scenario list:** "As quoted, all vendors" stays first, as the reference.
- **Award total card:** shows the active scenario's total. Its sub-line compares against As quoted, e.g. "₹x L more than as quoted, all vendors".
- **Deep links:** if a `#scenario=` hash is present, it wins over the default.
- **Cell guide:** its open/closed default no longer depends on the scenario. It is open by default, and the user's toggle is remembered.

---

## 3. Chat answer format

Every Parakh answer that produces or explains a scenario is shown in this order:

1. **Lead line** (16 px, 600): the answer plus the total. Example: "Yes: quality-cleared only costs ₹4.06 Cr, ₹x L more than as quoted."
2. **Up to 3 bullets** (15 px, 4 px gap). Leave out any bullet that has nothing to say.
   - Who is excluded and why: "Anand and Rohit Box excluded: Anand failed 2 mandatory items; Rohit Box didn't return the questionnaire."
   - The biggest lines that change hands (top 2–3 by value): "L14 Anand → Vardhman (+₹x L), L19 …"
   - Any open caveat: "Vardhman's discount is still unconfirmed (Doubt 2)."
3. **Scenario card:** unchanged.
4. **"Show working"** (accent-700 text toggle, caret icon), closed by default. Opening it reveals the full reasoning: rules applied, eligibility test per vendor, per-line moves, and the solver notes. This is the text the chat shows today.

No answer may show more than the lead line and 3 bullets before "Show working".

---

## 4. Vardhman's discount condition: once, then only where it matters

**Column header:**
- Add "‡" after Vardhman's quality line.
- Hovering or focusing it shows a tooltip, max 280 px: "Prices include a 2.5% discount that applies only to POs above ₹25 L. Our POs are ₹14–18 L. Doubt 2."

**Cells:**
- Remove the "?" from every Vardhman cell, except where removing the discount would change the winner **in the current scenario and filters**.
- The test: recompute the line with `gross` (undiscounted). If the winner changes, mark the cell "?" with the doubt fill (accent-2-100 / accent-2-800).
- Re-evaluate whenever the scenario changes.

**Doubts tab, row for Doubt 2:**
- Lines column: "**17 lines**" with a caret.
- Expanding it shows the line IDs as a wrapped list, with the subset where the winner flips in bold.
- The count is computed. Don't list the IDs inline.

---

## 5. One "checked and logged" number

Today the top card says "1 more checked and logged" while the Doubts tab says "14".

**Fix:**
- Derive both from one value: `loggedChecks.length`, the checks that ran but cannot change a winner.
- Both places read it. Label: "**n** more checked and logged, none changes a winner".
- Add a test that renders both and asserts they match.
- Find out which number is correct. If the card counts a different thing (e.g. doubts logged this session), rename it rather than reuse the label.

---

## 6. Quality score label and its maths

**Label format everywhere** (vendor header, Replies, Award, P menu): `Quality 90/100 ✓`

- Cleared: ✓ in accent-700.
- Not cleared: ✕ in accent-2-700, e.g. `Quality 20/100 ✕`.
- Not returned: "Quality: not returned".

**Vendor popover** (click the vendor's column header) gains a "How this score was worked out" table:

| # | Question | Type | Answer (as given) | Points |
|---|---|---|---|---|

- Rows are the 10 questionnaire items.
- Mandatory items show Pass/Fail.
- Footer: "Total n/100 · pass mark 70 · mandatory 2/2 passed → Cleared".
- Each answer links to its location in the vendor's questionnaire, using the same source viewer as prices.

**Check Anand's score:**
- Recompute it from his questionnaire answers using the marking scheme in the Evaluation rules tab.
- If the stored score differs from the computed one, the computed one wins.
- Log the correction in "Rule changes / corrections" with the old value, the new value and the reason.
- Report what you found in the PR description.

---

## 7. Anand L19: show both readings (logged, not escalated)

- **Cell tooltip:** "Two readings: ₹31.20 · ₹37.20 (hand-corrected). Using ₹31.20. Logged."
- **Source panel:**
  - The photo crop shows the corrected figure.
  - Under "As written" show both values side by side, each with its read confidence. The one in use is bold; the other is struck through.
  - A one-line note: "Logged. It doesn't change a winner in this scenario."
- **Doubt status:** don't raise it as a doubt and don't count it in "Need you". It goes into `loggedChecks`, so it is counted in item 5.
- **If it ever matters:** if a scenario makes the alternative reading change the winner, it moves into Doubts automatically (the existing rule).

---

## Done when

- All 7 items behave as described on the deployed site, in both the Buyer and VP views.
- No number on the Compare screen is hard-coded. The doubt count, logged count, totals and line counts all come from the solver output.
- The start strip's three actions each work from a fresh load and after a reset.
