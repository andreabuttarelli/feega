# Safari canvas zoom: dot grid on a 2D canvas, layer kept during gestures

Safari lagged on fast pan/zoom of a 23-motion-node canvas; Chromium measured 60/60 (PR #502).

Measured in Playwright WebKit (desktop, 1440×900) with an in-page rAF frame-time probe,
bisecting by hiding parts of the page:

- xyflow `<Background>` (SVG `<pattern>` whose size and offset change every frame): WebKit
  re-rasterizes it on every pan/zoom step. Hiding it took zoom from 29 to 59 fps on the real app.
- Poster `<img>`s re-resampled on every zoom step: once tiles had their real size, they alone
  kept zoom at 33 fps avg / 10 fps p5.

Changes:

- `CanvasDots.svelte` replaces `<Background>`: one 2D canvas, one pattern fill per viewport
  change (coalesced to one rAF), no draw when nothing moves. Below a 6 px step the dots are not
  drawn (they were a sub-pixel haze). Geometry in `dot-grid.ts`.
- `CanvasFlow.svelte` sets `will-change: transform` on the viewport only between xyflow's
  `onmovestart` and `onmoveend`: WebKit scales the cached layer during the gesture and
  re-rasterizes once, sharp, at the end. A permanent `will-change` would leave content blurry
  after a zoom in Chromium.

Discarded: one `rect` path per dot (frame work p95 7.8 ms in Chromium vs 5.5 ms with the
pattern fill).

Idle: before the change, on the real app in WebKit, canvas, paused inline editor and dashboard
showed 0 app rAF callbacks and no infinite CSS animation in 10 s. After, the guard measures the
canvas only (0); editor and dashboard need the database and were not re-measured.

Guard: `tests/e2e/canvas-frame-budget.spec.ts` (`E2E_PERF=1`, adds a `webkit-perf` project),
DB-free: mounts the real `CanvasFlow` with motion-sized tiles through
`tests/e2e/fixtures/motion-canvas-harness.ts`. Budgets ≥55 fps avg, ≥45 fps p5, idle ≤2 app
frames. `CANVAS_PERF_SOURCE` replays a recorded canvas.

Headless WebKit is not Safari on a GPU and caps rAF at 60 Hz: the 120 Hz claim rests on
per-frame main-thread work (p95 ≤5 ms, under the 8.3 ms budget), not on a measured 120 fps.
