# Handoff: Parakh — Sourcing co-pilot (Direction A, "Ledger")

## Overview
Parakh is an AI co-pilot workspace for a procurement buyer running one sourcing event. The demo event is 30 lines of corrugated boxes with five vendors, each replying in a different format (Excel, PDF, Word, a phone photo, a one-line email). Parakh reads every reply into one side-by-side comparison on a single basis (₹ per box, delivered, GST extra). It shows how each number was converted and where it came from, and raises only the doubts that could change who wins a line. The buyer (Vikram, category buyer) and his VP (Anita, VP Supply Chain) then ask what-if questions until they reach an award they can defend.

Design principle: **AI reads, code calculates, independent checks verify, the buyer decides.**

Direction A, "Ledger", is comparison-first. The 30 × 5 grid is the page. A full-height Conversation/Source panel sits on its right. Cell state is shown through typography, and colour is spent on one state only: a doubt.

## About the design files
The files in this bundle are **design references built in HTML**: prototypes that show the intended look and behaviour. They are not production code to copy directly. The task is to **recreate these designs in the target codebase's environment** (React, Vue, etc.) using its established patterns. If no environment exists yet, pick the most suitable framework (React + TypeScript is a natural fit) and implement them there.

The `.dc.html` files are self-contained "Design Component" pages. Open them in a browser from this folder (served over a local static server, e.g. `npx serve .`). Each has an HTML template with `{{ }}` holes, plus a `class Component` logic block (React-class-like: `state`, `setState`, `renderVals()`) inside a `<script data-dc-script>` tag. Read the logic block for the exact behaviour and computed values. `support.js` is the runtime that renders these files; do not port it.

## Fidelity
**High-fidelity.** Colours, typography, spacing, copy and interactions are final. Recreate them pixel-close, using the tokens below. The demo data is realistic but invented. In production it comes from the extraction/calculation pipeline (see "State & data").

## Screens / views

Target viewport: **desktop, 1440 px wide** (the app shell has `min-width: 1360px`). Light mode only.

### 1. Sourcing events (home) — `Shared Screens.dc.html` (default view)
- **Purpose:** list all sourcing events and open one.
- **Layout:** left nav 228 px (brand "Parakh" 22 px/600, then nav items with 18 px Phosphor duotone icons: Sourcing events, Vendors, Should-cost library, Templates, Reports; the user block is pinned to the bottom). The main column has padding `24px 40px 40px 12px` and `max-width: 1180px`.
- **Header:** H1 "Sourcing events" 34 px; subline "Packaging & print · FY27" in neutral-700; search input 280 px; primary button "New event" with a plus icon.
- **Status tabs** (gap 22 px, 14 px): All, Drafting, Collecting replies, Comparing, Awaiting approval, Awarded, Closed, each with a count. The active tab is 600 weight with a 2 px inset bottom rule in `--color-text`.
- **Table** (`.table`): Event (name 15 px/600 plus "ID · category" 12 px neutral-700), Status (tag: Comparing = `tag-accent`, Awaiting approval = `tag-accent-2`, Awarded = `tag-outline`, else `tag-neutral`), Lines, Replies, Value (₹ Cr), Next (due plus a 12 px note), and row actions (Open/Continue/View ghost button, Duplicate icon, More icon).
- The past event **SE-2025-037** carries the note "Source for 'same as last year' in SE-2026-041". This is what resolves Rohit Box's "rest same as last year".

### 2. RFQ co-pilot — `Shared Screens.dc.html#rfq`
- **Layout:** chat column 430 px on `--color-surface`, then the editable RFQ (flex 1, padding `22px 32px`).
- **Chat:** speaker label 11 px uppercase, letter-spacing 0.08em (Parakh in accent-700; Vikram in neutral-700). Messages are 14 px; the user's messages are italic and right-aligned. The composer is a textarea plus an icon send button.
- **RFQ:** a four-field header row (Deliver to, Replies due, Price basis asked, Contract period), then tabs: **Line items · 30**, **Questionnaire · 10**, **Terms**.
- **Line items:** an editable grid with columns `44px | minmax(180px,1.4fr) | 50 | 50 | 120 | minmax(150px,1fr) | 52 | 88 | 66` (Line, Box, Ply, Flute, L×W×H, GSM, BF, Print, Qty k). A row changed through chat (L14) gets an accent-100 background, a tag "changed by chat", and an accented ply input. New SKUs are tagged "new SKU".

### 3. Replies — `Shared Screens.dc.html#responses`
One row per vendor in a 3-column grid (`1.3fr 1fr 1fr`, gap 28 px):
- **Column 1, the reply:** vendor name 18 px/600, format icon plus filename, a "shape" description, received time/contact, the revised-quote note in accent-800, and an "Open original" link.
- **Column 2, coverage:** "27 of 30 lines quoted" (600), then a strip of 30 segments (9×14 px): neutral-700 = quoted, accent-2 = doubt, hollow with a 1 px neutral-400 inset = missing. Below it: the missing line IDs, the read status, and a one-line conversion note.
- **Column 3, quality:** questionnaire score/result, then attached documents (paperclip icon, name, status).

### 4 + 5 + 6. Comparison, Doubts, Conversation — `Comparison - Ledger.dc.html`
This is the core screen. Start states are available via hash: `#compare` (source panel open on Anand · L14), `#analyst` (VP scenario applied), `#doubts`.

**Shell:** `display:flex; height:100vh`, three parts:
1. **Icon rail**, 68 px: brand "P" 22 px, then Events, RFQ, Replies, Compare (active, accent), Award. Each is a 20 px icon over a 10 px label.
2. **Main**, flex 1, `overflow-y:auto`.
3. **Right panel**, 440 px, `--color-surface`, full height (shown on the Comparison tab only).

**Header** (padding `18px 28px 10px 8px`):
- An 11 px uppercase meta line: "SE-2026-041 · Sahyadri Appliances, Chakan · Vikram Deshpande".
- H1 "Corrugated boxes, FY27 H2" 26 px.
- A right-aligned basis statement: "Every price per box, in rupees, delivered Chakan, GST 18% extra."
- Buttons: Export (secondary) and **Freeze for award** (primary, links to the award record).

**Tabs:** "Comparison" | "Doubts **5** · ₹6.99 L at stake" (the count is in accent-2-700). 15 px; active = 600 weight with a 2 px inset bottom rule.

**Legend — "How to read a price"** (collapsible; open by default on As quoted, collapsed while a scenario is showing). Every example uses the same number, **24.60**, inside a 50 px chip with a 1 px divider inset, followed by a bold name and a one-line meaning:

| State | Treatment | Copy |
|---|---|---|
| Checked | plain ink, 400 | "as written, two reads agree" |
| Converted | `text-decoration: underline dotted neutral-600; text-underline-offset:3px` | "dotted line = a sum, click it" |
| Last year's price | italic, neutral-800, superscript "LY" 8 px upright | "italic, from SE-2025-037" |
| Unusual price | superscript ↑ / ↓ 10 px/600 | "↑ or ↓ over 12% from should-cost" |
| Not quoted | "—" in neutral-500 | "vendor skipped this line" |
| Doubt | **only filled state**: bg accent-2-100, text accent-2-800, 600, suffix "?" | "could change who wins" |
| Lowest | 600 weight | "bold = cheapest on the line" |

**Scenario bar** (always visible): "TABLE SHOWS" label, then pill tabs in a horizontally scrolling row (no wrap): **As quoted**, plus one per asked scenario ("Scenario 1 · Quality-cleared, cheapest per line", …). Active pill = accent fill with bg-coloured text; inactive = transparent with a 1 px divider inset and accent-800 text; radius `--radius-md`. On the right: a segmented **Table | Chart** control and "Export view".

**Scenario strip** (only when a scenario is active): bg accent-100, grid `1.8fr 1fr auto`, gap 24 px, 12.5 px text.
- Column 1: "SCENARIO n · RULES APPLIED", with the rules R1–R5 in two columns.
- Column 2: "EXCLUDED, AND WHY" (vendor name 600 — reason), plus "Asked by Anita Kulkarni, VP Supply Chain".
- Column 3: total 24 px/600, the delta vs cheapest overall in accent-800, the split ("Shree Balaji 11 · Vardhman 14 · Kaveri 5 lines"), and a ghost button "Back to as quoted".

**Grid** (`flex: 1 0 460px; min-height:460px`; scrolls internally):
- **Columns:** `40px | minmax(170px,1fr) | 44px | 64px | repeat(5, minmax(76px,96px)) | 104px` → Line, Box & spec (name plus an 11 px spec line, ellipsis), Qty, Should-cost, 5 vendors, Lowest.
- **Sticky header** (bg `--color-bg`, 1 px `--color-text` bottom rule). Each vendor header is right-aligned: short name 13 px/600; format icon + format name 11 px; quality line "Quality 86 ✓" / "Quality 58 ✕" / "No questionnaire"; an 11 px column note (e.g. "USD @ ₹88.20, −2.5% ‡", "27 of 30 quoted"). Excluded vendors drop to opacity 0.45 and the note reads "Excluded in scenario n".
- **Rows:** minimum 38 px high, with a bottom rule `color-mix(text 8%)`. The selected row gets a neutral-200 background.
- **Cells:** right-aligned 13.5 px `<button>`s with padding 0 10 px, styled per the legend. The selected cell gets a 2 px accent outline, offset −2. Excluded-vendor cells drop to opacity 0.4, and a doubt fill is dropped when its vendor is excluded.
- **Lowest column:** winner's short name; in a scenario, "was <vendor>" appears in 11 px accent-800 when the winner changed.
- **Footer:** lines won and award value per vendor (₹ L), plus the total (₹ Cr).
- Numbers use `font-variant-numeric: tabular-nums` everywhere.

**Chart view** (Table | Chart = Chart): two columns.
- Left, "Award value by vendor": two horizontal 12 px bars per vendor, neutral-400 = as quoted and accent = the current scenario, with ₹ L labels.
- Right, "Lines that change hands": a `.table` (Line, From, To, +₹/box, +value).

**Right panel** — tabs "Conversation" and "Source · L14 Anand" (the label reflects the selected cell). 14 px, with icons.
- **Conversation:**
  - Thread padding 16/22 px, gap 18 px. Parakh messages: label 11 px uppercase accent-700, body 14 px.
  - When a message produced a scenario, it carries a result card (bg `--color-bg`, `--shadow-sm`, padding 12/14) containing: "SCENARIO n · APPLIED TO THE TABLE", total 20 px/600 + delta, the split, "4 rules · 2 vendors excluded", and buttons Table / Chart / Export (secondary, 12 px).
  - Human messages are right-aligned italic 15 px; the label shows the name plus a role tag (VP = `tag-accent-2`, Buyer = `tag-neutral`).
  - Composer: suggestion chips (unasked scenarios), an "Asking as" segmented control (Vikram · buyer / Anita · VP), and a textarea plus an icon send button.
- **Source:** see SourceDoc below, plus "Same line, every vendor" (one clickable row per vendor: name, state label, price; the current vendor is highlighted accent-100).

**Doubts tab:**
- Intro: "Only doubts that could change who wins a line, ranked by rupees at stake. 19 more were checked and logged — none of them changes a winner."
- Header grid `40px | 1fr | 120px | 110px | 120px` (Rank, Doubt, Lines, Goes to, At stake).
- Each row shows the rank 22 px/600 in accent-2-700, title 16 px/600, the why text, line IDs, the route, and the stake 16 px/600.
- Expanding a row shows the ask (600), then either a **drafted email** (To · Subject, a textarea with the body; buttons "Approve & send" / "Edit in mail" / "I'll call instead") or **judgement options** (radios plus "Record decision" / "See source").

### SourceDoc (child component) — `SourceDoc.dc.html`
Props: `vid` (vendor id SB/VP/KP/AC/RB) and `li` (line index 0–29). The layout is two flex columns (wrap):
- **Left, the original as it looked:**
  - Excel: a grid with column letters and row numbers; the hit cell has bg accent-200 and a 2 px accent outline.
  - PDF: a letterhead with a USD table; footnote ‡ is highlighted, magenta if the cell is a doubt.
  - Word: a paragraph with the exact sentence highlighted.
  - Photo: a rate card rotated `perspective(900px) rotateX(9deg) rotateZ(-3.5deg)` with `.halftone`; the hit row is outlined; the hand-corrected price is shown struck through with italic handwriting above.
  - Email: header fields plus the one line, with the phrases used highlighted.
- **Right, the reasoning:** "AS WRITTEN" vs "ON OUR BASIS" (20 px/600 each), then the pipeline steps in a `92px | 1fr` grid: **Read** (AI read) → **Calculate** (Code) → **Verify** (Independent check, incl. the should-cost band) → **Decide** (You). For a doubt, a magenta header reads "Doubt n of 5 · ₹x L at stake. <title>".

### 7. Award record — `Shared Screens.dc.html#award`
- **Main column:**
  - Meta line "Award record · SE-2026-041 · for approval by Anita Kulkarni, VP Supply Chain"; H1 "Split award to three quality-cleared vendors" 34 px; buttons "Ask a what-if" (links to the comparison `#analyst`) and **Approve award**.
  - A summary paragraph (16 px).
  - KPIs (26 px/600 over a neutral-700 label): award value, delta vs cheapest, vs last year like-for-like, vendor count.
  - "Decisions on record": each doubt and how it was resolved.
  - "Snapshot at decision", marked with a lock icon and "Frozen 9 Oct 2026, 16:42 · snapshot 7c41e9 · later revisions will not change these numbers". Its table has columns Line, Box, Awarded to, ₹/box, Qty, Value, Source. Clicking a row selects it.
- **Right trace panel**, 470 px sticky on surface: SourceDoc for the selected row.

## Interactions & behaviour
- **Click any price** → select the cell (outline + row tint), switch the right panel to Source, and render SourceDoc for that vendor and line. "Same line, every vendor" rows switch the vendor.
- **Ask a question** (suggestion chip, or send) → append a human message (with the current "Asking as" identity) and a Parakh answer with a result card. Add a scenario pill, make it active, set the view to Table, and switch the panel to Conversation. The thread auto-scrolls to the bottom.
  - The prototype maps free text to the next unasked scenario. Production should parse the question into the same structured rule set.
- **Scenario pills** switch which solution the grid, footer, strip and chart show. "Back to as quoted" returns to the baseline.
- **Table | Chart** toggles the view for the active scenario. Export buttons are visual only.
- **Legend toggle** → user override of the default (open on As quoted, collapsed in a scenario).
- **Doubts:** clicking a row toggles its expansion (one open at a time; D1 open by default).
- All interactive elements use the design-system states: hover tint from the accent ramp, pressed = accent-600, focus = `outline: 2px solid var(--color-accent); outline-offset: 2px`. There are no animations.

## State & data
Component state (comparison screen):
- `tab: 'compare' | 'doubts'`
- `sel: { vid, li } | null`, the selected cell
- `pane: 'conv' | 'src'`
- `scen: 'base' | 'S1' | 'S2' | 'S3'`, the active scenario
- `asked: [{ id, asker: 'VP' | 'Buyer', text }]`, which drives both the thread and the pills
- `asker`, `view: 'table' | 'chart'`, `openD`, `q`, `legend`

**Scenarios** (see `defs()` and `solve()` in the logic block):
- **S1** — eligible = questionnaire returned, score ≥ 70, both mandatory items passed (excludes Anand: 58, no ISO; and Rohit Box: not returned). Each line goes to the lowest eligible price.
- **S2** — S1, plus open doubts priced against us: Vardhman without the 2.5% discount (`gross`), Rohit freight +₹0.38, L19 at ₹37.20, no 3-ply substitute.
- **S3** — S1, plus a cap of 40% of award value per vendor. Greedily move the cheapest-to-move line from the over-cap vendor to its next-cheapest eligible option until no vendor is over the cap.

**Data** (`data.js` → `window.KD`). This is mock data, but its shape is a good starting schema:
- `lines[30]`: id, name, ply, flute, dims, gsm, bf, print, qty. `sc` is should-cost = board kg × ₹41 (3-ply) / ₹44 (5-ply) + print; `kg` comes from blank area × GSM.
- `vendors[5]`: id, name, short, fmt, file, shape, colNote, quality `{score, cleared, returned}`, docs.
- `cells[vid][li]`:
  - `p`: price on our basis, or null
  - `raw`: as written
  - `unit`
  - `kind`: `ok | conv | ly | oor | miss | doubt`
  - `loc`: source location
  - `steps`: `[stage, actor, text]`
  - `ratio`/`dev` vs should-cost; `oor` when |dev| > 12%
  - `doubt` id
- `doubts[]`: id, rank, vid, lines, stake (₹), route (`vendor` | `buyer`), kind, title, why, ask, email `{to, subject, body}` or options. Sorted by stake. **Stake** is line qty × (worst-case price − read price).
- `baseline` / `qual` = `solve()` results `{ per[30]: {vid, p, changed}, total, by[vid]: {lines, value} }`.

Conversions encoded in `data.js` (production should run these as deterministic code, not AI):
- **USD → ₹** at the RBI reference rate of ₹88.20 (8 Oct 2026), then less the 2.5% footnote discount.
- **Per 100 pieces → per box:** (price + freight per 100) ÷ 100.
- **Per kg → per box:** board weight × rate + print (from last year's event SE-2025-037) + estimated freight of ₹0.42 a box.

Formatting: Indian grouping (`en-IN`), "₹x.xx L" for lakhs and "₹x.xx Cr" for crores.

## Design tokens (Broadsheet design system — `_ds/.../styles.css`)
- **Font:** Source Serif 4 (Google Fonts, weights 400/600, italic 400) for everything, including UI chrome. No sans-serif.
- **Colours:**
  - Base: bg `#f3f2f2`, surface `#eae9e9`, text `#201e1d`, accent `#0088b0`, accent-2 `#d6006c`, divider `color-mix(#201e1d 16%)`.
  - Neutral ramp: 100 `#f8f4f4` · 200 `#eae7e7` · 300 `#d7d3d3` · 400 `#bab6b6` · 500 `#9b9797` · 600 `#7d7979` · 700 `#605d5d` · 800 `#444141` · 900 `#2d2b2b`
  - Accent ramp: 100 `#e9f8ff` · 200 `#cbeeff` · 300 `#99e0ff` · 400 `#62c5ee` · 500 `#38a6cf` · 600 `#1186ac` · 700 `#006786` · 800 `#004961` · 900 `#0a303e`
  - Accent-2 ramp: 100 `#fff1f4` · 200 `#ffdee6` · 300 `#ffc0d0` · 400 `#ff90b1` · 500 `#ff458e` · 600 `#d82071` · 700 `#aa0b56` · 800 `#790e3d` · 900 `#4b1528`
- **Colour usage rules:**
  - Cyan (accent) is for interactive elements, selection and scenario surfaces.
  - Magenta (accent-2) is reserved for doubts and the VP tag. Never use both accents in one small component.
  - For accent text at body size, use accent-700/800, not the base accent.
- **Spacing:** 5 / 10 / 15 / 20 / 30 / 40 px (`--space-1…8`).
- **Radius:** 1 / 2 / 4 px.
- **Shadows:**
  - sm: `0 1px 2px color-mix(#2d2b2b 14%)`
  - md: `0 3px 10px color-mix(#2d2b2b 16%)`
  - lg: `0 12px 32px color-mix(#2d2b2b 22%)`
- **Type sizes used:**
  - 34 (page H1), 26 (comparison H1), 24/22/20 (totals, ranks, H3), 18 (panel title)
  - 15/14 (tabs, chat), 13.5 (grid cells), 13 (base), 12/11 (meta)
  - 10–11 px uppercase labels with letter-spacing 0.08em
- **Layout ethos:** no boxes or dividers to structure the page; hierarchy comes from the serif scale and whitespace. Thin rules are used only as table furniture (header and footer rules on the grid).
- **Components used from the system:** `.btn` (primary/secondary/ghost/icon), `.tag` (accent/accent-2/neutral/outline), `.input`, `.field`, `.radio` + `.dot`, `.seg`, `.table`, `.halftone`.

## Assets
- **Icons:** Phosphor Icons, **duotone** weight (`@phosphor-icons/web@2.1.1`). Used: tray, note-pencil, envelope-open, table, seal-check, export, chats-circle, file-magnifying-glass, chart-bar-horizontal, file-xls, paper-plane-right, x, caret-right/down, question, microsoft-excel-logo, file-pdf, file-doc, camera, envelope-simple, plus, copy, dots-three, paperclip, lock-simple, users-three, calculator, files, chart-line.
- **No raster images.** The vendor source documents (Excel, PDF, Word, photo, email) are drawn in HTML as stand-ins. Production renders the real uploaded file, with a highlight overlay at the extracted location.
- All names (Parakh, Sahyadri Appliances, the vendors, the people) are invented.

## Files
- `Overview.dc.html` — one-page summary of the direction (idea, cell states, trade-offs, links)
- `Comparison - Ledger.dc.html` — screens 4, 5, 6 (comparison, doubts, conversation and scenarios)
- `Shared Screens.dc.html` — screens 1, 2, 3, 7 (home, RFQ co-pilot, replies, award record); switch with the hash `#rfq`, `#responses`, `#award`
- `SourceDoc.dc.html` — the source/trace panel component
- `data.js` — the mock dataset, conversion maths, doubts and baseline/quality solvers
- `_ds/…/styles.css` — design tokens and component classes; `_ds_bundle.js` is the design-system bundle
- `support.js` — the prototype runtime only; not part of the design
