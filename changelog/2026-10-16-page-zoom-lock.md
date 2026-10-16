# Pinch and ⌘± never zoom the page on canvas and editor

Before: ctrl/⌘+wheel or a trackpad pinch over a panel (outside the SvelteFlow pane, or over a
`nowheel` element) and ⌘+/−/0 reached the browser, which zoomed the whole page and pushed bars
and panels off screen.

Now: `lockPageZoom` (`src/lib/canvas/page-zoom.ts`) owns every page-zoom input in one place:
ctrl-wheel blocked in capture, forwarded to the canvas if it bubbles to window (d3-zoom stops
propagation over the pane, so no double zoom); Safari `gesture*` blocked and forwarded only when
the gesture sent no ctrl-wheels; ⌘+/=/−/0 blocked and mapped to zoom in/out/fit when the key region
is the canvas. `PageZoomLock` adds a `user-scalable=no` viewport meta and `touch-action: pan-x
pan-y` on the root. Mounted by `CanvasFlow` (via `CanvasZoomLock`) and the motion editor page
(block only: the editor already maps ⌘± to its preview).

Test: `tests/e2e/page-zoom-lock.spec.ts` (chromium; webkit under `E2E_REAL_STACK=1`).
