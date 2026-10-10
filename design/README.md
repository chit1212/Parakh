# Handoff: Parakh — Sourcing co-pilot (Direction A, "Ledger")

> **Start here, Claude Code.** Work in this order:
> 1. **`CHANGES - Review fixes.md`** + **`Review Fixes.dc.html`**: the latest priority fixes from the submission review: analytical correctness, visible trust, a simpler hierarchy, and charts. **Do these first.**
> 2. **`CHANGES - Reviewer polish.md`**: the start-here strip, the default scenario, the chat answer format, Vardhman's ‡, quality labels, and Anand L19.
> 3. **`Target Screens v2.dc.html`** + the "Readability pass v2" section below: the approved visual redesign for every screen.
> 4. The rest of this README: base behaviour, data and rules.
>
> Where documents conflict, the higher item in this list wins. The VP is **Meera** (replace "Anita" everywhere). Numbers in the design files come from the prototype's `data.js`; compute everything from your own data, and never hard-code a figure.

## Overview
Parakh is an AI co-pilot workspace for a procurement buyer running one sourcing event. The demo event is 30 lines of corrugated boxes with five vendors, each replying in a different format (Excel, PDF, Word, a phone photo, a one-line email). Parakh reads every reply into one side-by-side comparison on a single basis (₹ per box, delivered, GST extra). It shows how each number was converted and where it came from, and raises only the doubts that could change who wins a line. The buyer (Vikram, category buyer) and his VP (Anita, VP Supply Chain) then ask what-if questions until they reach an award they can defend.

Design principle: **AI reads, code calculates, independent checks verify, the buyer decides.**

Direction A, "Ledger", is comparison-first. The 30 × 5 grid is the page. A full-height Conversation/Source panel sits on its right. Cell state is shown through typography, and colour is spent on one state only: a doubt.

## About the design files
The files in this bundle are **design references built in HTML**: prototypes that show the intended look and behaviour. They are not production code to copy directly. The task is to **recreate these designs in the target codebase's environment** (React, Vue, etc.) using its established patterns. If no environment exists yet, pick the most suitable framework (React + TypeScript is a natural fit) and implement them there.

The `.dc.html` files are self-contained "Design Component" pages. Open them in a browser from this folder (served over a local static server, e.g. `npx serve .`). Each has an HTML template with `{{ }}` holes, plus a `class Component` logic block (React-class-like: `state`, `setState`, `renderVals()`) inside a `<script data-dc-script>` tag. Read the logic block for the exact behaviour and computed values. `support.js` is the runtime that renders these files; do not port it.

## Fidelity
**High-fidelity.** Colours, typography, spacing, copy and interactions are final. Recreate them pixel-close, using the tokens below. The demo data is realistic but invented. In production it comes from the extraction/calculation pipeline (see "State & data").

## ⚠ Read this first — Readability pass v2 (supersedes older specs below)
**`Target Screens v2.dc.html` is the build target.** Each section shows the current prototype ("Before", live iframe or live-site screenshot) beside the approved redesign ("After"). Where this section or the "After" frames disagree with the per-screen specs further down, **v2 wins**. The older specs remain valid for behaviour, data, rules and anything v2 doesn't mention.

Goal: a reviewer with 5–10 minutes must understand any screen in about 2 minutes. Pattern taken from Stripe (a few key numbers first, details one click away), Linear (one-row toolbar, filters added on demand) and Coupa/Ariba bid analysis (the best bid per line highlighted, totals above the grid).

### Global changes (every screen)
- **Type:** body 16 px (was 13–14); table cells 15–17 px; small labels min 14 px (13 px only for rail labels and vendor sub-lines). Uppercase 10–11 px micro-labels are replaced by 14–15 px sentence-case labels in neutral-700.
- **Contrast:** no text lighter than `--color-neutral-700` (`#605d5d`), except "—" for not quoted (neutral-600/700).
- **H1:** 30–32 px/600, line-height 1.15, with a 15 px neutral-700 meta line above.
- **Depth:** the page sits on `--color-bg`. The working table or list sits on a **raised sheet**: bg `--color-neutral-100` (`#f8f4f4`), `--shadow-md`, radius `--radius-lg` (4 px), padding 16–24 px. Key-number cards use the same fill with `--shadow-sm`. Side panels (chat, source, trace) stay on `--color-surface` with no shadow.
- **Key-number cards:** a 3- or 4-column grid, gap 12–16 px. Each card: label 14–15 px neutral-700, value 26–30 px/600, optional 14 px neutral-800 sub-line. The doubts card uses bg accent-2-100 with text accent-2-800.
- **Table headers:** 14–15 px/600 neutral-800 with a 2 px `--color-text` inset bottom rule. Rows have a 1 px neutral-200/300 inset bottom rule and hover `--color-bg`.
- **Icon rail:** 84 px wide (was 68). The "P" mark is 44 × 44, bg `--color-text`, text `--color-bg`, 22 px/700, radius-lg. Items are 68 px wide with a 24 px duotone icon over a **13 px label** (was 10 px). Active item: bg accent-200, text accent-800, 600, radius-lg. Inactive: neutral-800.
- **Colour:** cyan only for actions, selection and winners; magenta only for doubts.
- **VP name:** **Meera** (matches the live site). Replace "Anita" everywhere, e.g. "Send to Meera for approval", "Remind Meera".

### 00 · Flow
Sign in → Events → RFQ → Replies → Compare → Award. "P" opens the workspace menu from every screen. Shown as a strip at the top of the target file.

### 01 · Events
- **Header:** "Sourcing events" plus search (300 px) and primary "New event".
- **Key numbers (3 cards):** Need you this week · Open value · Next deadline.
- **Status filter:** pill chips (All / Comparing / Collecting / Drafting / Awaiting approval / Awarded, each with a count). Active chip = `--color-text` fill; inactive = 1 px neutral-400 inset. A "+ Filter" link sits in accent-700.
- **Table (5 columns):** Event (name 17 px/600 + ID 14 px) · Stage (tag) · Due · Value · Next step. Rows are 64 px.
- **Next step:** one action per row. The most urgent ("Review 5 doubts") is a primary button; the others are accent-700 text links with "→".
- **Row actions:** the **Clone** (`ph-copy`) and **More** (`ph-dots-three`) icon buttons stay on every row.

### 02 · RFQ
- **Keep input boxes everywhere.** The boxes signal that the RFQ is editable; do not convert them to a plain table.
- **Four key terms:** `.field` + `.input` in a 4-column grid, 42 px high, 15 px text.
- **Line grid:** inputs 38 px high, 15 px text. Columns `40 | 1.5fr | 44 | 52 | 112 | 128 | 44 | 76 | 56`.
- **Tabs:** Lines 30 · Quality questions 10 · Terms, at 17 px with a 3 px accent underline on the active tab.
- **Evaluation rules:** collapse to one pill at the right of the tabs: lock icon + "Rules · 14 · lock when sent" + "Edit". The full Evaluation rules tab remains behind it.
- **Co-pilot (380 px):** shows the last 3 messages, with "Show 6 earlier messages" above them. Messages are 16 px.

### 03 · Replies (simplified for daily use)
- **Rule:** each row answers four questions: did they reply, is it complete, did they pass quality, what needs me? Everything else moves into the row's detail view.
- **Removed** (always true, learned once):
  - the intro "Read by AI, every number checked by code…"
  - "All lines quoted"
  - "Every price checked against the original"
  - the card sub-lines "every one traced to its source" and "10 messages in the inbox…"
- **Header:** meta line + H1 "Replies". On the right: a "Reading scorecard" text link (accent-700, 15 px), secondary **"Upload a reply"** (`ph-upload-simple`), and primary "Open comparison".
- **Upload (kept for the live demo):** "Upload a reply" toggles a raised strip under the header containing "Choose file", "No file chosen · up to 4 MB", a "From" dropdown ("Work it out from the file") and primary "Read it" (disabled until a file is chosen). It is closed by default.
- **Cards (3, no sub-lines):** Replied 5 of 5 · Prices read 147 of 150 · Need you **4** · 2 lines · 2 messages (accent-2-100 card).
- **Table** (`28 | 1.5fr | 120 | 140 | 150 | 1.6fr | 80`), rows 62 px, whole row clickable:
  - **Caret:** caret-right when closed, caret-down when open.
  - **Vendor:** name 17/600, plus "1 Oct, 16:05 · Sanjay Agarwal" (14 px neutral-700).
  - **Sent as:** format icon + one word (Excel / PDF / Word / Photo / Email).
  - **Lines priced:** "30 of 30" plain; when incomplete, bold "27 of 30 · 3 blank".
  - **Quality:** tag "90 · cleared" (tag-accent) / "20 · not cleared" (tag-neutral) / "Not returned" (tag-outline).
  - **Needs you:** exceptions only, 15 px accent-2-800, each prefixed **Message** (ask the vendor) or **Line** (your call), e.g. "Message 2.5% discount only above ₹25 L per PO". "—" when nothing is needed.
  - **"Open":** link at the end of the row.
- **Open row (one at a time):** three columns:
  - **File:** name + attachments.
  - **Price basis, as read:** e.g. "Per box in USD, delivered Chakan" and "2.5% trade discount if one PO exceeds ₹25 L".
  - **Quality documents:** certificates with dates, plus "How code marked it".
  
  Then the buttons "Open original" and "See what was read", plus "Read 9 Oct by <models>" and "Read again live".
- **Data:** live-site values (scores 90 / 80 / 70 for Shree Balaji, Vardhman, Kaveri). Production computes "Needs you" from open doubts: route `vendor` = Message, route `buyer` = Line.

### 04 · Compare (each change approved one by one)
1. **Header:** title 30 px; "SE-2026-041 · award by 15 Oct" above it; tabs **Compare** | **Doubts 5** (count in accent-2-700) beside the title; primary "Freeze for award" on the right.
2. **Three key-number cards:** Award total · vs last year, same 25 boxes (value in accent-800) · Doubts that could change a winner (accent-2-100 card, "5 · ₹6.99 L").
3. **Scenario dropdown:** shows the scenario name only (e.g. "Cheapest per line"). The one-line rule description moves inside the open list. **Remove the rule text below the toolbar.**
4. **Toolbar (one row):** scenario dropdown · chips **All 30 / Doubts n / Not checked** · "+ Filter" (opens Won by, Board, Unusual, Missing, Last year's) · **Sort** (stays visible) · "Cell guide" toggle on the right.
5. **Quality score under each vendor name:** 13 px neutral-700, e.g. "95 · cleared" or "quality not returned".
6. **Winner:** 700 weight with a **pale fill**: bg accent-200, radius-sm, padding 2 × 6 px. A winner with a doubt uses bg accent-2-100, text accent-2-800 and a "?" suffix. This replaces "bold = lowest".
7. **Losing prices do not fade.**
8. **Uncleared vendors are not greyed out** in any scenario.
9. **Table text 15 px**, rows 36 px. About 15 of the 30 lines are visible with the guide open; the grid scrolls.
10. **The table sits on a raised sheet** (see Global).
11. **Chat:** the last 3 messages plus "Show n earlier messages"; at most 3 suggested questions as small raised chips.
12. **Kept as is:** the collapsible **cell guide** (all states: winner, winner with a doubt, converted, last year's, unusual, not quoted). The full-height right panel keeps its **Conversation** and **Source · <line> <vendor>** tabs. Clicking a price opens Source with SourceDoc and the "I've checked this" / "Check & open next winner" buttons; the selected cell gets a 2 px accent ring.

### 05 · Award
- **Header:** "Split award to three quality-cleared vendors" (28 px) plus primary "Send to Meera for approval" (buyer) or "Approve award" (VP).
- **Key numbers (4 cards):** Award total · vs last year · Cost of quality rule · Prices you checked.
- **"Who gets what":** one row per vendor: Vendor · Lines · Value · Share (8 px accent bar + %) · Quality tag.
- **Collapsed rows:** "Decisions on record" and "Rule changes after sending" (caret, 17 px/600 title, 15 px sub-line).
- **Line snapshot (keep):** Line · Box · Awarded to · ₹/box · Value · Checked by you. Clicking a row selects it (accent-100 + 3 px accent left inset).
- **Trace panel (keep), right side, 440 px on surface:** "Trace" + line title, then SourceDoc for the selected line.

### 06 · Workspace menu (P)
- **Same contents as the live site** (see `assets/live-p-menu.png`): Current event · Switch event (3 recent + "All events →") · Signed in as · Demo: view as (Vikram · buyer / Meera · VP) · Evaluation rules for this event · Sign out · **Reset demo** (Start empty: RFQ, upload, compare / Back to the full demo).
- **Popover:** 420 px, bg neutral-100, `--shadow-lg`, padding 22 × 24. Section labels are 14 px/600 neutral-800 sentence case (not uppercase). The event name is 21 px/600 with a status tag. Event rows are 17 px with a 14 px ID and a status tag; hover accent-100.
- **View-as switch:** a 2-segment control; the active segment is filled accent.
- **Links:** 17 px accent-700 with 22 px icons.
- **Reset demo:** sits in its own `--color-bg` box at the bottom.
- **P button:** while open, the P mark is filled accent with a 3 px accent-200 ring.

## Screens / views

Target viewport: **desktop, 1440 px wide** (the app shell has `min-width: 1360px`). Light mode only.

### App shell and navigation (all screens)
Every screen shares one shell: a **68 px icon rail** on the left, then the screen content. The rail holds the brand mark "P" (22 px/600, a button that opens the workspace menu — see below), then five items, each a 20 px Phosphor duotone icon over a 10 px label: **Events, RFQ, Replies, Compare, Award**. The active item is `--color-accent`; the others are neutral-700. There is no other navigation chrome.

**Compare is the home screen** (the app opens on it). The flow:
1. **Compare** (home) — comparison, doubts, conversation and scenarios.
2. **Events** — the list of sourcing events. Opening SE-2026-041 returns to Compare.
3. **RFQ** — co-pilot chat, plus the drafted RFQ.
4. **Replies** — the five vendor replies, their coverage and quality.
5. **Award** — the recommendation and a frozen snapshot. "Ask a what-if" returns to Compare with "Cheapest per line, quality-cleared only" applied.

### Workspace menu — `WorkspaceMenu.dc.html` (child component, mounted in the rail of every screen)
- **Trigger:** the "P" button, 44 × 44, radius `--radius-md`. Its background is accent-100 while the menu is open.
- **Popover:** 340 px wide, `left: 52px; top: 0`, bg `--color-bg`, `--shadow-lg`, padding `18px 20px 16px`, gap 16. A transparent fixed backdrop closes it when you click outside.
- **Sections** (each with an 11 px uppercase label):
  1. **Current event:** name 16 px/600, then "SE-2026-041 · Comparing · award by 15 Oct".
  2. **Switch event:** three recent events (name, then "ID · status"; hover accent-100), and an "All events…" link.
  3. **Signed in as:** name (600) and "role · Sahyadri Appliances". A "Demo: view as" `.seg` switches between Vikram · buyer and Anita · VP.
  4. **Links:** "Evaluation rules for this event" (`ph-scales`, goes to `Shared Screens#rules`, the RFQ Evaluation rules tab) and "Sign out" (`ph-sign-out`, goes to `#login`).
- **Role:** stored in `localStorage['parakh-role']` (`'Buyer' | 'VP'`) and broadcast as a `window` `CustomEvent('parakh-role')`. Effects:
  - The chat's "Asking as" control follows the role, and setting it there updates the menu.
  - On the award record, the primary button is **"Send to Anita for approval"** for the buyer and **"Approve award"** for the VP.
- **Production:** the role comes from the signed-in user's permissions. The demo switch is for showing both views only.

### Sign in — `Shared Screens.dc.html#login`
- **Shown after "Sign out".** The icon rail is hidden on this screen.
- **Layout:** a flush-left column, vertically centred, padding-left 14vw, max-width 620 px.
- **Content, top to bottom:**
  - "Parakh" 26 px/600
  - H1 "Sign in" 40 px
  - subline "Your sourcing workspace at Sahyadri Appliances."
  - a Work email field
  - primary button "Continue with company sign-in" (nowrap; returns to Compare)
  - a 12 px caption: "Single sign-on · no separate password"
  - a 12 px note: "You've been signed out. Your checks, scenarios and draft emails are saved with the event."

Screen headers follow one pattern: an 11 px uppercase meta line, then a 26 px H1. Content starts 8 px from the rail.

### 1. Sourcing events — `Shared Screens.dc.html#events`
- **Purpose:** list all sourcing events and open one.
- **Layout:** the shared icon rail, then a main column with padding `18px 40px 40px 8px` and `max-width: 1180px`.
- **Header:** meta line "Sahyadri Appliances · Packaging & print · FY27"; H1 "Sourcing events" 26 px; search input 280 px; primary button "New event" with a plus icon.
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
1. **Icon rail**, 68 px: the shared rail (see App shell), with Compare active.
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

**Report toolbar** (always visible, padding `2px 28px 10px 8px`). This replaces the old scenario pills.
- **Row 1, dropdowns** (native `<select class="input">`, 34 px high, 13 px; each has an 11 px uppercase label above it):
  - **Scenario** (340 px): the six strategies listed under "Scenarios" below, always available.
  - **Won by** (150 px): Any vendor, or one vendor.
  - **Board** (110 px): All boxes / 3-ply / 5-ply.
  - **Sort by** (220 px): Line number · Rupees at stake in doubts · Award value, highest first · Closest calls (gap to 2nd) · Furthest above should-cost.
  - Right-aligned: the segmented **Table | Chart** control and "Export view".
- **Row 2, "Show" quick filters** (single-select chips, 12.5 px, radius `--radius-md`; active = accent fill, inactive = 1 px divider inset with accent-800 text). Each chip shows its count:
  - All lines
  - With doubts
  - Winner changed (only while a scenario is active)
  - Winner not verified by you
  - Unusual price
  - Missing quotes
  - Last year's prices
- **Right of row 2:** "Showing 12 of 30 lines · ₹x L" and a ghost "Clear filters" button (keeps the sort).
- **When filtered:** the footer totals only the shown lines ("Shown lines · value"). If no lines match, the grid shows "No lines match these filters."
- **Behaviour:** filters apply to the active scenario's winners, and excluded vendors are ignored when testing a line. Asking a question in the chat adds its scenario to the dropdown and selects it.

**Scenario strip** (only when a scenario is active): bg accent-100, grid `1.8fr 1fr auto`, gap 24 px, 12.5 px text.
- Column 1: "<SCENARIO TITLE> · RULES APPLIED", with the rules R1–R5 in two columns.
- Column 2: "EXCLUDED, AND WHY" (vendor name 600 — reason), plus "Asked by Anita Kulkarni, VP Supply Chain".
- Column 3: total 24 px/600, the delta vs cheapest overall in accent-800, the split ("Shree Balaji 11 · Vardhman 14 · Kaveri 5 lines"), and a ghost button "Back to as quoted".

**Grid** (`flex: 1 0 460px; min-height:460px`; scrolls internally):
- **Columns:** `40px | minmax(170px,1fr) | 44px | 64px | repeat(5, minmax(76px,96px)) | 104px` → Line, Box & spec (name plus an 11 px spec line, ellipsis), Qty, Should-cost, 5 vendors, Lowest.
- **Sticky header** (bg `--color-bg`, 1 px `--color-text` bottom rule). Each vendor header is right-aligned: short name 13 px/600; format icon + format name 11 px; quality line "Quality 95 ✓" / "Quality 20 ✕" / "No questionnaire"; an 11 px column note (e.g. "USD @ ₹88.20, −2.5% ‡", "27 of 30 quoted"). Excluded vendors drop to opacity 0.45 and the note reads "Excluded on quality".
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
  - When a message produced a scenario, it carries a result card (bg `--color-bg`, `--shadow-sm`, padding 12/14) containing: "<SCENARIO TITLE> · APPLIED TO THE TABLE", total 20 px/600 + delta, the split, "4 rules · 2 vendors excluded", and buttons Table / Chart / Export (secondary, 12 px).
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
  - Meta line "Award record · SE-2026-041 · for approval by Anita Kulkarni, VP Supply Chain"; H1 "Split award to three quality-cleared vendors" 26 px; buttons "Ask a what-if" (links to the comparison `#analyst`) and **Approve award**.
  - A summary paragraph (16 px).
  - KPIs (26 px/600 over a neutral-700 label): award value, delta vs cheapest, vs last year like-for-like, vendor count.
  - "Decisions on record": each doubt and how it was resolved.
  - "Snapshot at decision", marked with a lock icon and "Frozen 9 Oct 2026, 16:42 · snapshot 7c41e9 · later revisions will not change these numbers". Its table has columns Line, Box, Awarded to, ₹/box, Qty, Value, Source. Clicking a row selects it.
- **Right trace panel**, 470 px sticky on surface: SourceDoc for the selected row.

### Verified by you (buyer sign-off)
- **Source panel:** under SourceDoc, an unverified, quoted cell shows a primary button "I've checked this" and a secondary button "Check & open next winner", plus a 12 px note. For a doubt the note reads "Confirms the number matches the document. Doubt n stays open until it is resolved." Once verified, a row on accent-100 shows a 22 px seal-check icon, "Verified by you", "Vikram Deshpande · 9 Oct, 15:41 · recorded on the award", and an Undo button.
- **Grid:** verified cells get a 12 px `ph-seal-check` in accent-700 before the number. The legend has a new entry, "Verified by you".
- **Tab row (right):** "**8 of 30** winning prices verified by you / 8 of 147 of all quoted prices", plus a "Check next winner" button that jumps to the next unverified winner in the active scenario.
- **Award record:** a new snapshot column, "Checked by you" ("✓ 9 Oct, 15:41" or "not yet"), and a KPI "x of 30 awarded prices checked by Vikram".
- **Storage:** `localStorage['parakh-verified']` maps `"VID:lineIndex"` to a timestamp, seeded with 8 entries. Production should store the user, the time and the snapshot/version of the cell that was verified. Undo is allowed until the award is frozen.

### RFQ → Evaluation rules tab (`Shared Screens.dc.html#rfq`, 4th tab)
- **Intro:** a lock-open icon and a sentence: rules lock when the RFQ is sent; later changes need a reason and are shown to the VP; Shared rules go to vendors, internal ones never do.
- **Plain-words box** (surface fill): an input plus a primary "Draft rule" button with a sparkle icon. Caption: "Parakh drafts the rule; code runs it. You see the rule and its effect before it applies." The co-pilot chat shows an example (rejection rate scored out of 15). The rows it changed get accent-100 and a "changed by chat" tag.
- **Five sections.** Each has an H3 20 px, a tag and a 12.5 px note:
  1. **Quality score** (`tag-accent`, "Shared with vendors"): a table with columns `30px | 1.3fr | 120px | 1.6fr | 70px` → #, Question, Type (Mandatory in accent-2-800/600, or Scored), Marking (editable), Points (editable). Then "100 points in total", an editable pass mark (70), and the clearing rule. Points: 10, 10, 10, 10, 10, 10, 10, 15, 10, 5.
  2. **Price basis** (Shared).
  3. **Conversions** (`tag-neutral`, Internal).
  4. **Should-cost** (Internal · never sent).
  5. **Doubts** (`tag-outline`, Company default, read-only with a lock icon).
- **Rule rows** use the grid `1.2fr | 1.5fr | 140px`: name (600) with a 12 px "how" line, an editable value (or a locked value), and "used by" (e.g. "30 prices · Vardhman").
- **Production:**
  - Rules are versioned and locked when the RFQ is sent.
  - Every "Calculate" step in SourceDoc should link to the rule and version it used.
  - The award snapshot stores those rule versions.

**Quality scores under this scheme (demo):** Shree Balaji 95, Vardhman 95, Kaveri 75 (all cleared); Anand 20 (both mandatory items failed, not cleared); Rohit Box did not return the questionnaire.

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
- `asked: [{ id, asker: 'VP' | 'Buyer', text }]`, which drives both the thread and the Scenario dropdown
- `f: { show, win, ply, sort }`, the report toolbar filters
- `verified: { 'VID:li': timestamp }`, the buyer sign-off (persisted)
- `asker`, `view: 'table' | 'chart'`, `openD`, `q`, `legend`

**Scenarios** — a fixed library of general award strategies, listed in the Scenario dropdown in this order (see `defs()` and `solve()` in the logic block). Each has a plain title plus a one-sentence description, shown in 13 px neutral-800 under the toolbar's dropdown row. Every scenario except "As quoted" applies the quality gate: questionnaire returned, score ≥ pass mark, both mandatory items passed.
- **As quoted — cheapest per line, all vendors** (`base`): each line to its lowest price, doubts priced as read. The cheapest possible result; useful for comparison, rarely what you'd award.
- **Cheapest per line, quality-cleared only** (`S1`): each line to the lowest eligible price.
- **Two vendors only, lowest total** (`S5`): tries every pair of eligible vendors that together cover all 30 lines; each line goes to the cheaper of the pair; the pair with the lowest total wins. Rule R5 lists the best three pairs with their totals and how many pairs were tried.
- **One vendor for everything, lowest total** (`S4`): only eligible vendors who quoted all 30 lines qualify; the lowest total wins. R5 lists every candidate's total.
- **Spread the risk, no vendor above 40%** (`S3`): cheapest per line, then greedily move the cheapest-to-move line from any vendor above 40% of award value to its next-cheapest eligible option, until no vendor is above the cap.
- **Worst case on open doubts** (`S2`): cheapest per line with every open doubt resolved against us — Vardhman without the 2.5% discount (`gross`), Rohit freight +₹0.38, L19 at ₹37.20, no 3-ply substitute. Shows the most the doubts can cost.

Scenario labels are always descriptive; there is no "Scenario 1/2/3" numbering. A scenario reached through a chat question shows "· asked in chat" in the dropdown, and the strip shows "Asked by <name>, <role>". In production the chat should map a question onto one of these strategies, or onto a new combination of the same building blocks: eligibility gate, vendor count limit, share cap, doubt pricing.

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
  - 26 (every screen's H1), 24/22/20 (totals, ranks, H3), 18 (panel title)
  - 15/14 (tabs, chat), 13.5 (grid cells), 13 (base), 12/11 (meta)
  - 10–11 px uppercase labels with letter-spacing 0.08em
- **Layout ethos:** no boxes or dividers to structure the page; hierarchy comes from the serif scale and whitespace. Thin rules are used only as table furniture (header and footer rules on the grid).
- **Components used from the system:** `.btn` (primary/secondary/ghost/icon), `.tag` (accent/accent-2/neutral/outline), `.input`, `.field`, `.radio` + `.dot`, `.seg`, `.table`, `.halftone`.

## Assets
- **Icons:** Phosphor Icons, **duotone** weight (`@phosphor-icons/web@2.1.1`). Used: tray, note-pencil, envelope-open, table, seal-check, export, chats-circle, file-magnifying-glass, chart-bar-horizontal, file-xls, paper-plane-right, x, caret-right/down, question, microsoft-excel-logo, file-pdf, file-doc, camera, envelope-simple, plus, copy, dots-three, paperclip, lock-simple, users-three, calculator, files, chart-line.
- **No raster images.** The vendor source documents (Excel, PDF, Word, photo, email) are drawn in HTML as stand-ins. Production renders the real uploaded file, with a highlight overlay at the extracted location.
- All names (Parakh, Sahyadri Appliances, the vendors, the people) are invented.

## Files
- **`Target Screens v2.dc.html` — the approved readability redesign: Before vs After for every screen, plus the flow. Build to the After frames.**
- `assets/live-p-menu.png`, `assets/live-replies.png` — screenshots of the live site, used as "Before" references
- `Overview.dc.html` — one-page summary of the direction (idea, cell states, trade-offs, links)
- `Comparison - Ledger.dc.html` — **home screen**; screens 4, 5, 6 (comparison, doubts, conversation and scenarios). Start here.
- `Shared Screens.dc.html` — screens 1, 2, 3, 7 (events, RFQ co-pilot, replies, award record); switch with the hash `#events`, `#rfq`, `#rules` (RFQ → Evaluation rules), `#responses`, `#award`, `#login`
- `SourceDoc.dc.html` — the source/trace panel component
- `WorkspaceMenu.dc.html` — the "P" workspace menu (event switcher, role, rules, sign out)
- `data.js` — the mock dataset, conversion maths, doubts and baseline/quality solvers
- `_ds/…/styles.css` — design tokens and component classes; `_ds_bundle.js` is the design-system bundle
- `support.js` — the prototype runtime only; not part of the design
