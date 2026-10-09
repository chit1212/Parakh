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

Next: first real run (`npm run scorecard -- --only=5_rohit_email`, then a full run), tune prompts against the misses, then `npm run scorecard -- --save` and commit `data/readings/`. The free tier may allow only ~20 Flash calls a day; a full run is ~20-25 calls.

## Decisions (technical)
- "Strict schema" is Gemini's `responseJsonSchema`, generated from the zod schemas, and the answer is validated again in code.
- The app reads `GEMINI_API_KEY`, or `PARAKH_GEMINI_API_KEY` in a dev container. In a container with an egress proxy (never on Vercel), Node's fetch is pointed at the proxy.
- Model outputs are cached by content hash (`.cache/readings`, or `/tmp` on Vercel) so re-reading an unchanged file uses no quota (development only; the demo uses `data/readings/`).
- Fonts and icons are bundled from npm (no CDN at runtime).
