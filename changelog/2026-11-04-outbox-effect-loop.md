# Canvas froze on open: outbox reopen looped its effect

After the 2026-11-04 release, opening a canvas threw `effect_update_depth_exceeded` and froze
the tab. The `$effect` in `src/routes/p/[projectId]/c/[canvasId]/+page.svelte` that reopens the
kept outbox (added in 3bf630799, "Show kept changes from the first paint after reload") called
`reopenOutbox` tracked. Its synchronous part reads and writes `nodes` (`placedRows`,
`restoreDraws`), so the effect depended on what it wrote and re-ran forever.

Fix: `reopenOutbox` runs under `untrack`; the effect depends only on `openedOutboxKey`.

Guard: `tests/e2e/canvas-opens-without-effect-loop.spec.ts` (real stack) opens a canvas with a
frame and fails on any `effect_update_depth_exceeded`.
