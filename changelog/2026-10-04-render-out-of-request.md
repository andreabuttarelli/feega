# Server render out of the request

**Before.** `startRender` ran the whole farm inside the action via `runInBackground` (waitUntil on
the 300 s function). Motion blur renders whole on one sandbox, so `BLUR_BUDGET` capped it at 4000
samples at 1080p; any render over ~5 min died with the function. Output bytes came back through
the function and were uploaded from there (50 MB cap, `oversize`).

**Now.**
- The action creates the `node_runs` row, stores the `FarmJob` as `work/<runId>/job.json`, forks one
  sandbox per chunk and starts a detached `steps.mjs` in each. It returns in seconds.
- Each chunk but the first uploads itself to a signed upload URL. The first sandbox stays as head.
- `reconcileRenders` (canvas runs tick) claims each running render, reads `result-<task>.json`
  from each sandbox, retries a failed or vanished chunk once on a new sandbox (`MAX_ATTEMPTS`),
  starts the assembly on the head (download chunks, mix, concat/mux, size check, upload to the
  export path), then saves (C2PA marking), charges, notifies and cleans up.
- Cancel: `cancelRender` action: run failed `cancelled`, sandboxes stopped, nothing charged.
- Blur cap: replaced by a time rule tied to the whole-route sandbox lifetime (2 h). 60 s 1080p60
  at 8 samples fits; plan length caps stay in `render-length.ts`.
- Upload limit: `storage-limit.ts` binary-searches the bucket/project max with zero-byte TUS
  `POST`s (413 = over). Shown in the dialog, enforced in the sandbox before upload.
- `expireStuckRuns` deadline for renders: `RENDER_DEADLINE_MS` (3 × whole lifetime).
- Render asset URL TTL 15 min → 6 h: a retried chunk fetches assets much later.

**Discarded.** TUS from the sandbox with a signed upload token: storage-api rejects it under RLS
(403). A signed-URL `PUT` works and the global limit applies either way.
`getCommand().exitCode` to poll: stays `null` across sessions; a result file is reliable.
