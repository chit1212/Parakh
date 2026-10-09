# Saved demo readings

Model answers from a clean full run of the reader on the demo event, committed so the demo opens
without paid model calls. Each file is named by a fingerprint of the file content, prompt and model,
so if a vendor file or a prompt changes, that answer is no longer used and the reply is read again.

Refresh with `npm run scorecard -- --fresh --save` (needs an API key), then commit this folder.
These are the reader's own outputs. They are never edited by hand and never come from the answer key.
