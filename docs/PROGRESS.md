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
- Home screen (`/`, L28): Sourcing events per the design. SE-2026-041 and SE-2025-037 come from the dataset and code; the other five rows are display-only stubs (`src/lib/workspace.ts`). Left nav per the design; "Reports" opens the test scorecard.
- Design: `design/` is now the Ledger handoff; `design/README.md` is the spec.

## Decisions (technical)
- "Strict schema" is Gemini's `responseJsonSchema`, generated from the zod schemas, and the answer is validated again in code.
- The app reads `GEMINI_API_KEY`, or `PARAKH_GEMINI_API_KEY` in a dev container. In a container with an egress proxy (never on Vercel), Node's fetch is pointed at the proxy.
- Model outputs are cached by content hash (`.cache/readings`, or `/tmp` on Vercel) so re-reading an unchanged file uses no quota (development only; the demo uses `data/readings/`).
- Fonts and icons are bundled from npm (no CDN at runtime).
