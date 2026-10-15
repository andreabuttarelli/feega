# Canvas page over bearer

The canvas page's `load` and actions moved to `$lib/server/canvas/canvas-page.ts` (pure move,
the route re-exports them) and are served to a bearer client by
`/api/v1/projects/[projectId]/canvases/[canvasId]` (`GET` = load, `POST ?action=` = action).

Why: ADR 0009 (d) — the canvas must run client-only inside the native bundle. Running the same
handlers makes page/API parity structural; `server.test.ts` checks it for write (incl. 409 keys),
upload into library, create, move, connect, run, frame_template, template, audio_voices,
apply_effects, effects_pair, draw/group/ungroup/place/move element.

Discarded: routing the client through `CANVAS_OPS`. Ops are the agent dialect (agent actor,
200 + error body) and differ in rules from the actions; switching would have changed behaviour.
Answer convention in ADR 0013.
