# Progress log

A short handoff note so any session can pick up where the last one stopped.

## Milestone 1: Reading (in progress)

Built:
- RFQ lines, questionnaire and last year's prices parsed in code from `dataset/`; box weight and should-cost computed in code (`src/lib/geometry.ts`), matching the answer key on all 30 lines.
- File readers (`src/lib/files/`): Excel with cell refs, Word with paragraph and table-row labels, email, PDF text layer (for checks only). PDFs and photos go to the model natively.
- Demo inbox (`src/lib/inbox.ts`): one reply per folder in `03_vendor_replies`, plus the failure cases; vendor matched by sender address.
- Reading pipeline (`src/lib/reader/pipeline.ts`): open (code) → sort (Gemini Flash-Lite) → read prices and sweep terms (Gemini Flash, structured output, in parallel) → check every source in code (`verify.ts`) → coverage. Values whose source check fails never enter the comparison.
- Screens: Replies (`/events/SE-2026-041/replies`) with live progress per reply, and the test scorecard (`/scorecard`).
- `npm run scorecard` grades the saved readings against `06_answer_key` (`--live` reads again; grading only; `test/isolation.test.ts` pins that nothing else reads the key).
- Saved readings (`src/lib/saved.ts`, `data/readings/`): `npm run save-readings` reads the demo replies once, one at a time, and saves each with its date and model. The Replies screen opens with them ("Read on <date> by <model>", "Read again live"); unread replies wait for a click, so page visits spend no quota.
- Per-visitor limit on live model calls (`src/lib/guard.ts`): 15 an hour per visitor, 200 a day in all.
- Free-tier rate limits: `withBackoff` in `src/lib/ai.ts` retries per-minute limits, stops at once on a daily limit, and every error reaches the buyer as a calm sentence (`calmMessage`).

Waiting on: `GEMINI_API_KEY` reaching a cloud session (2026-10-09: added in the environment settings; this session predates it). Next session: `npm ci`, `npm run save-readings`, commit `data/readings/`, `npm run scorecard`, then tune the prompts. If the free daily quota runs out part way, re-run the next day; finished replies are kept.

## Decisions (technical)
- 2026-10-09: AI provider switched to the Google Gemini API free tier (`@google/genai`). Reader: `gemini-3.8-flash` (current stable Flash per Google's model list). Sorting step: `gemini-3.5-flash-lite`, which has its own free quota, so sorting does not use up the reader's. Both in `src/lib/config.ts`. Free-tier Flash was reported at about 20 requests a day; a reading is 1 Flash-Lite + 2 Flash calls.
- Structured output: `responseJsonSchema` generated from the same zod schemas, and code validates the answer again (Gemini does not guarantee it).
- Cloud dev sessions: the key can be a network secret (header `x-goog-api-key` on `generativelanguage.googleapis.com`); with no key and a proxy set (never on Vercel), `src/lib/ai.ts` routes calls through the proxy and drops the placeholder header. Verified the route reaches Google.
- Model outputs are cached by content hash (`.cache/readings`, or `/tmp` on Vercel) so re-reading an unchanged file costs nothing.
- Fonts and icons are bundled from npm (no CDN at runtime).
