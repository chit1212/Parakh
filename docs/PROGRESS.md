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

Waiting on: the Anthropic API key, then the first real run of `npm run scorecard` and tuning the prompts against it.

## Decisions (technical)
- "Strict schema" is done with structured outputs (`output_config.format`), the supported way on Sonnet 5.5, which does not accept forced tool choice.
- The app reads `ANTHROPIC_API_KEY`, or `PARAKH_ANTHROPIC_API_KEY` in a dev container where the plain name would clash with the container's own tools. The client pins the API base URL so a machine-wide `ANTHROPIC_BASE_URL` is never picked up.
- Model outputs are cached by content hash (`.cache/readings`, or `/tmp` on Vercel) so re-reading an unchanged file costs nothing.
- Fonts and icons are bundled from npm (no CDN at runtime).
