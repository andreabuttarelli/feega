# Shift+2 zooms to the element inside a frame

`zoom-selection` only fitted the tile boxes, so with an element picked inside a frame it zoomed to
the whole frame. `GpuFlow.zoomToSelection` now fits the picked elements' outlines (`picker.outline`)
at up to the canvas maximum zoom, and falls back to the tiles when nothing is picked inside.
Checked in a real browser: `tests/e2e/canvas-zoom-nested.spec.ts` (the element grows past 1.5x).
