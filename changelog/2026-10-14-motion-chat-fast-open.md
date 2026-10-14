# Motion editor: the session no longer waits on the upload-limit probe

In production the motion editor chat sat on its skeleton for 8–15 s after a frame was opened
(inline or full screen). The chat mounts with the editor, and the editor session
(`loadEditorSession`) awaited `motionRenderStorage().limit()`: a binary search of ~40 serial
POSTs to Supabase `upload/resumable`, cached per serverless instance, so every cold instance paid
it. Locally `farmAccess` is null without `VERCEL=1`, so the probe never ran and nobody saw it.
Evidence: Supabase `edge_logs` on 2026-10-14 07:43:59–07:44:07 show the burst of `413` probes
between the session reads and the chat's `chat_messages` read.

`uploadLimits()` in `storage-limit.ts` now exposes `known()`: it starts the probe and returns the
limit only if already settled. The session uses it; renders still await the real number. The
only consumer of the session value is a hint in the export dialog, which now shows from the
second open on a cold instance. Discarded: a hard-coded limit (the probe exists because the
project's limit is configurable).

Guard: `tests/e2e/motion-chat-load.spec.ts` (real stack; red only with the dev server started
with `VERCEL=1`).
