# Change request: submission review fixes

The fixes are worked through one at a time. Each section pairs a design, found in `Review Fixes.dc.html` (copy it into the handoff folder alongside `data.js`), with the logic that only code can fix.
**Rule for every section:** no hard-coded numbers. Every figure comes from the same computed store the Compare table uses.

---

## Fix 1: Analytical correctness

### 1.1 One fact store for the table and the chat
- **Problem:** the analyst said last year's prices were missing, while the dashboard compares 28 lines against last year.
- **Fix:** the chat or analyst must call the **same functions/store** as the UI. That store covers: lines, last-year prices, the cell matrix, eligibility, scenario allocations and totals.
- **No second copy:** don't hand the LLM a separately built summary. Give it tools, e.g. `getLines()`, `getScenario(id)`, `yoyDrivers(scenarioId, n)` and `allocate(constraints)`.
- **Add a tool `yoyDrivers(scenarioId, n)`:** for every line with `lyPrice`, compute `(winnerPrice − lyPrice) × qty`, sort descending and return the top n. Also return `comparableLines` (the count) and `net`.
- **Design (1a):**
  - The answer opens with one line: net change plus the top-n sum.
  - Ranked bars follow, one per line: ID, name, rupee amount, a magenta bar, and a "vendor · ly → now per box · qty" sub-line.
  - A source chip reads "Same data as the Compare table · n lines have last year's price".
  - "Show working" sits at the end.

### 1.2 Allocation under constraints must be exact, or say it isn't
- **Problem:** a 37% share cap gave L26 to Kaveri at ₹11.23 instead of Shree Balaji at ₹10.41. That move saves ₹10,660 and keeps every share under 37%.
- **Fix:** replace the heuristic with an exact solver.
  - The problem is a small MILP: binary x[line][vendor], one vendor per line, and `Σ value(v) ≤ cap × Σ value` for each vendor.
  - The total is part of the share constraint, so linearise it as `value(v) − cap × total ≤ 0`.
  - The size is ≤ 30 × 5 binaries, so `javascript-lp-solver` or `glpk.js` solves it in milliseconds.
- **Status:** the result carries a `status` of either `proven_optimal` or `feasible`, set by solver timeout or failure.
- **Self-check after every allocation:** try every single-line move to a cheaper eligible vendor. If any move is cheaper and still within the constraints, the result is **not** optimal. Downgrade the status, and log the move in the working.
- **Design (1b), on the scenario card:**
  - Status tag: `Proven cheapest` (tag-accent, seal-check icon) or `Meets the cap · not proven cheapest` (tag-outline, warning icon) with a "Find cheaper" action.
  - Supplier-share bars, each showing %, value and line count, with a 2 px ink marker at the cap.
  - A "Self-check passed" line.
  - The total in ₹ Cr, plus the **exact rupee total**.
- **Wording:** never use the words "minimum cost" unless the status is `proven_optimal`.

### 1.3 Every comparison states its baseline
- **Problem:** asked for the premium over quality-cleared cheapest per line, the answer used all-vendor cheapest (₹8.15 L, when it should have been about ₹3.14 L). It also left out the exact total and the shares.
- **Fix:**
  - Parse the requested baseline from the question. If it is ambiguous, default to the **active scenario's eligibility** (quality-cleared), never to all vendors.
  - The answer object must carry `baselineId`, `baselineTotal`, `total`, `delta` and `shares[]`.
- **Design (1c):**
  - The first element of the answer is a **"Compared with" box** naming the baseline, with a **Change** dropdown that re-runs the comparison.
  - Lead line: "The cap costs ₹x more. Total ₹exact."
  - A three-bar cost comparison: As quoted, all vendors (benchmark, neutral) · the baseline (ink) · this scenario (accent).
  - Bullets: shares for every supplier, and the biggest lines that move.
  - "Show working" gives baseline exact, scenario exact and the difference.
- **Requested items:** if the user asks for specific items (an exact total, percentages), the answer must include them. Add a post-check that each requested item appears, and regenerate if one is missing.

### 1.4 Regression tests (add all three)
1. "Five biggest contributors to the YoY increase among quality-cleared vendors" returns 5 lines whose amounts match `yoyDrivers`.
2. 37% cap: the solver result has no profitable single move; it reproduces the L26 → Shree Balaji case and asserts the result total is ≤ the old one − ₹10,660.
3. "Premium of the 37% cap vs quality-cleared cheapest per line, exact total and supplier %": the baseline is quality-cleared, the delta equals `capTotal − qualTotal` (about ₹3.14 L on live data), and every supplier % is present.

---

## Fix 2: Make trust visible and precise

### 2.1 Rohit Box: freight pending (design 2a)
- **Column header:** a `tag-accent-2` "Freight pending" tag under the Rohit Box name.
- **Cells:** every Rohit Box price gets a magenta superscript "+F".
- **Header text:** the grid's "delivered Chakan" header must not claim a delivered price for Rohit Box.
- **Provisional totals:** any total that includes a Rohit Box line is **Provisional**. Show a `tag-outline` "Provisional" plus a dashed 1 px neutral-400 outline on the card, with the sub-line "n lines won by Rohit Box exclude freight. Assumed ₹0.42/box until he confirms."
- **Data:** add `vendor.freight: 'included' | 'pending'`, plus `scenario.provisional = lines.some(l => winner(l).freight === 'pending')`.

### 2.2 Award total defaults to eligible vendors (design 2b)
- **Headline card:** "Award total · quality-cleared vendors". This is the default scenario (see the earlier reviewer-polish change).
- **Benchmark:** the all-vendor number sits below as a quieter line: "Benchmark · as quoted, all vendors". It is always labelled a benchmark, never "Award total". The sub-line names the vendors who can't be awarded.

### 2.3 One count, split by scenario (design 2c)
- **Single source:** the header and the Doubts tab read one value, `loggedChecks.length`. Add a test asserting the two render the same number.
- **Group the Doubts tab:**
  - "Can change a winner here · n" first, on magenta-100 rows.
  - "Don't affect this scenario · n" second, muted, each row giving a reason ("Anand not eligible").
- **Recompute on scenario change:** a doubt affects a scenario if flipping it changes any winner in that scenario's allocation.
- **Doubts tab count:** shows the "affects" count only.

### 2.4 Three assurance levels (design 2d)
- **Per-cell `assurance`:**
  - `ai`: read by AI, not matched.
  - `matched`: code found the same number in the file's text layer or cell.
  - `verified`: the buyer clicked "I've checked this"; record name and time.
- **Photos:** no text layer, so they stay `ai` until verified.
- **Badges:**
  - Read by AI: `tag-outline`, sparkle icon.
  - Matched to source: `tag-neutral`, link icon.
  - Verified by you: `tag-accent`, seal-check icon.
- **Where they show:** in the source panel step list, and as per-vendor counts on the Replies screen.
- **Copy:** replace "Every number checked by code against the original file" with "Typed files are matched to the source by code. Photo readings need your check."

### 2.5 Award states (design 2e)
- **States:** `draft` → `in_review` → `submitted` → `approved`, shown as a 4-step bar at the top of the Award screen. The current step is accent; the rest are neutral-300.
- **Remove "Frozen".** A snapshot is "Snapshot saved <time> · not submitted".
- **Blocking submission:** while any blocker exists, "Send to Meera for approval" is **disabled**. Blockers show in a magenta-100 box, "Can't submit yet", each with an action link:
  - open doubts affecting the chosen scenario;
  - winning prices on doubt lines not verified;
  - freight pending.
- **Test:** submission must be impossible with open blockers, both in the UI and in the API.

---

## Fix 3: Simplify around the buyer's decision (design: 1280 px frame)
- **Order:**
  1. **Scenario selector:** a labelled dropdown, with "Compared with <baseline> · Change" beside it and the Table | Chart segmented control at the right. Scenarios are **removed from Filters**.
  2. **Decision summary strip:** one raised row with Award total · vs baseline · Doubts that could change a winner (n · ₹). A collapsed "Rules: n vendors excluded · Show" sits at the right.
  3. **Comparison:** one row of filter chips (All / Doubts / Not checked / + Filter / Sort / Cell guide), then the table.
  4. **Inspector, always on the right on every screen:** tabs Source | Conversation, collapsible with a caret-double-right icon. Remember the open/collapsed state per user.
- **"See source" and clicking a price** switch the inspector to Source **immediately**. No intermediate screen.
- **Persistence:** the Table/Chart choice and the inspector state persist across scenario changes, in the URL hash plus localStorage.
- **No page-level horizontal scroll at 1280 × 800:**
  - rail 72 px; inspector 330 px; table columns `minmax(150px,1.5fr) repeat(5, minmax(0,1fr))`; 14 px cells; text-overflow ellipsis on line names;
  - add a Playwright check at 1280 px: `document.documentElement.scrollWidth <= 1280`.
- **Detailed rules and exclusions** move behind "Show" (a popover or the RFQ › Evaluation rules tab).

---

## Fix 4: Use visuals to answer questions (Chart view)
All charts follow the active scenario and share one data source with the table.
- **4a · Scenario cost vs baseline:** a diverging bar per scenario around a zero line at the baseline. Cheaper is cyan to the left, dearer is magenta to the right. Columns: label, total, bar, delta. The baseline row is bold and shows "baseline".
- **4b · Supplier share:** horizontal bars with %, value and line count, plus a 2 px ink marker at the allocation cap (with a legend). The same component is used in the chat scenario card (Fix 1b).
- **4c · Biggest increases vs last year:** ranked magenta bars, top 5 by rupees, from `yoyDrivers()` (Fix 1.1).
- **4d · Doubts ranked by ₹ at stake:** only doubts that can change a winner in the active scenario, with "n more don't affect this scenario · Show".
- **4e · One colour job per status:**
  - Selected = 2 px cyan ring.
  - Winner = pale cyan fill, bold.
  - Verified = cyan seal-check after the number.
  - Uncertain = pale magenta fill plus "?".
  - Failed = solid magenta-800 tag with white text.
  - **Eligibility badges:** `✓ Quality 95/100` (tag-accent) · `✕ Quality 20/100` (solid magenta-800) · `Quality: not returned` (tag-outline).
  - **Numbers:** all prices use tabular figures, right-aligned, two decimals.
- **Keep the table.** Chart view is an alternative, not a replacement.

---

## Before recording
- Run one coherent end-to-end flow: RFQ → replies → compare → resolve doubts → draft → submit.
- Test unexpected questions and constraints in the chat (caps, exclusions, baselines).
- Verify that exports open correctly.
- Write the one-page "decisions and omissions" note.
