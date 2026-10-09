# Progress log

A short handoff note so any session can pick up where the last one stopped.

## Milestone 1: Reading (in progress)

Built:
- RFQ lines, questionnaire and last year's prices parsed in code from `dataset/`; box weight and should-cost computed in code (`src/lib/geometry.ts`), matching the answer key on all 30 lines.
- File readers (`src/lib/files/`): Excel with cell refs, Word with paragraph and table-row labels, email, PDF text layer (for checks only). PDFs and photos go to the model natively.
- Demo inbox (`src/lib/inbox.ts`): one reply per folder in `03_vendor_replies`, plus the failure cases; vendor matched by sender address.
- Reading pipeline (`src/lib/reader/pipeline.ts`): open (code) → sort (Haiku) → read prices and sweep terms (Sonnet, structured output, in parallel) → check every source in code (`verify.ts`) → coverage. Values whose source check fails never enter the comparison.
- Screens: Replies (`/events/SE-2026-041/replies`) with live progress per reply, and the test scorecard (`/scorecard`).
- `npm run scorecard` grades the reader against `06_answer_key` (grading only; `test/isolation.test.ts` pins that nothing else reads the key).
- Per-visitor limit on paid model calls (`src/lib/guard.ts`).

- AI provider switched to the Google Gemini API free tier (`@google/genai`): `gemini-3.8-flash` reads, `gemini-3.5-flash-lite` sorts (`src/lib/config.ts`, with fallbacks). JSON-schema structured output, checked again with zod. Busy/rate-limited calls retry with backoff, then fall back, then show a calm message (`src/lib/reader/call.ts`).
- Saved readings (`data/readings/`, committed, `src/lib/saved.ts`): `npm run scorecard -- --save` writes one file per reply, stamped with date and model and fingerprinted against the reply's files. The demo opens with them ("read on <date> by <model>") and each reply has "Read again live".

- First real runs on Gemini (9 Oct 2026): reading 944 of 945 fields right; every source checked; all 4 failure files handled; 21 of 22 planted edges. Saved to `data/readings/` (10 files). The demo opens with them; no model calls on load.
- Known miss: Anand L19 (hand-corrected 31.20 whose 1 looks like a 7) is read as 37.20, flagged corrected_by_hand, without the other reading. The Replies screen already shows it as "needs a look"; milestone 4 must treat any hand-corrected number as a doubt even when the reader lists no alternatives.
- Gemini 3.8 Flash answered "high demand" (503) throughout; the readings were made by the fallbacks (3.5 Flash; 3.5 Flash-Lite for sorting). Each reading names its models.

## Milestone 2: Normalising (started)
- `src/lib/normalise.ts`: code puts every price on INR per box, delivered: per 100 / per kg (weight from the RFQ spec) / USD at the reference rate / freight and handling from the checked terms; conditional discount and "if freight is as last year" kept as separate values; never guesses (unclear unit or currency leaves the cell unpriced with the reason); a revision supersedes the earlier offer and says what changed.
- Graded by the scorecard: 149 of 150 converted values match the answer key to the paisa (the miss is L19 above); discount 30/30; last-year freight 30/30. `test/normalise.test.ts` pins the arithmetic without the model.
- Comparison screen (`/events/SE-2026-041/compare`, `src/lib/compare.ts`): 30 lines x 5 vendors on one basis from the saved readings, cell states (checked, converted, last year, unusual ±12%, not quoted, lowest), winners and award value per vendor. As quoted, all 30 winners and the total (Rs 4,00,77,050) match the answer key (`test/compare.test.ts`). A substitute spec, a price >12% below should-cost, or an incomplete reply is shown but cannot win until the buyer or vendor confirms.
- Source panel (L15): the original drawn with the place highlighted (`/api/source`, `src/lib/sourceview.ts`, `src/components/SourceDoc.tsx`): Excel grid with the cell outlined, Word row/sentence, email line, PDF page laid out from its text positions, the photo with the reader's area boxed, and last year's workbook. Checked in the browser on all six. Then as written vs on our basis, and Read / Calculate / Verify / Decide.
- App shell per the updated design: one 68 px icon rail on every screen (`src/components/Rail.tsx`); Compare is the home screen (`/` redirects to it). Events list at `/events` (L28): SE-2026-041 and SE-2025-037 from the dataset and code; the other five rows are display-only stubs (`src/lib/workspace.ts`). The design has no place for the test scorecard, so `/scorecard` is linked from the Replies header.
- Design: `design/` is now the Ledger handoff; `design/README.md` is the spec.

## Decisions (technical)
- "Strict schema" is Gemini's `responseJsonSchema`, generated from the zod schemas, and the answer is validated again in code.
- The app reads `GEMINI_API_KEY`, or `PARAKH_GEMINI_API_KEY` in a dev container. In a container with an egress proxy (never on Vercel), Node's fetch is pointed at the proxy.
- Model outputs are cached by content hash (`.cache/readings`, or `/tmp` on Vercel) so re-reading an unchanged file uses no quota (development only; the demo uses `data/readings/`).
- Fonts and icons are bundled from npm (no CDN at runtime).

## Milestones 3 and 4 (done)
- L18 checks: last year's price per cell, spec change named (L21 5-ply to 7-ply); unit sanity (5x off should-cost).
- Quality (`src/lib/quality.ts`): cleared = questionnaire returned + valid ISO 9001 + test report within 12 months of the RFQ, all checked in code. The 0-100 score needs a marking scheme the RFQ does not give: milestone 5 (L26).
- Doubts (`src/lib/doubts.ts`): every candidate (conditional discount, unknown freight, substitute spec, far below should-cost, hard-to-read number) is re-solved in the cheapest-overall and quality-cleared views; raised only if a winner changes, ranked by rupees, routed to vendor or buyer. Doubts tab and magenta doubt cells on Compare. Vendor emails drafted by Gemini on request (`/api/draft`), only that vendor's own figures; approve is stubbed.
- Scorecard grades doubts and totals against the answer key: 9 of 9 pass.

## Milestone 5 (analyst chat) done; quality score still open
- Scenario solver (`src/lib/scenario.ts`): eligibility (all / quality-cleared / exclusions), discount and freight assumptions, held cells, worst case, share cap, line overrides. Matches all four answer-key scenario totals (`test/compare.test.ts`).
- Chat (`/api/chat`): Gemini function calling with read_comparison, run_scenario, get_cell_source, show_view; the model never does sums. The client re-solves each returned rule set in code and applies it to the table: scenario pills, rules/excluded strip, "was X", faded excluded vendors, chart view.
- Free tier: on 9 Oct the three Flash models hit their daily limit; Flash-Lite models are now the last fallback for reading and chat, and daily-limited models are skipped until the next day. A busy model (503) is no longer reported as "used up for today".
- Not done: a 0-100 quality score (no marking scheme in the RFQ); the header shows pass/fail with reasons.

## Milestones 6 and 7 (done)
- Freeze for award (Compare) -> snapshot in the browser; Award record `/events/SE-2026-041/award` with KPIs, rules, decisions on record (doubt decisions and overrides), frozen table and trace panel; VP approval; Excel and PDF memo from `/api/export` (exceljs, pdf-lib).
- Upload a reply (Replies) -> `/api/upload` parses in code and streams the real reading; kept in the browser session; a later reply replaces only the lines it prices.
- L17 revised quote: what changed and whether it moves a winner (Replies). L32 override with audit trail (source panel). L29 counter-offer drafted by Gemini (source panel), target set in code, no other vendor named. L0 RFQ co-pilot `/events/SE-2026-041/rfq`: Gemini edits the draft via tools; start from the issued RFQ or clone SE-2025-037.
- Open: a 0-100 quality score (the RFQ has no marking scheme; pass/fail is shown with reasons). Uploaded files are not drawn in the source panel (not kept on the server).
