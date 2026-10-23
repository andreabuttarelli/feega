# Resize redraws the shape every frame

Reopened canvases: dragging a corner moved the selection but the shape stayed
at an intermediate size until release. The frame placeholder took the live
box size unrounded; the wasm core deserializes `DisplayList.width/height` as
`u32`, threw on the fraction, and every later paint of the gesture aborted.
Freshly drawn shapes hid it: their sizes stayed integral at zoom 1.

`placeholder()` now rounds to whole pixels (min 1). The #1152 e2e measured the
blue selection outline, not the fill; `canvas-resize-redraw.spec.ts` samples
the fill inside the new area, outside the old, and fails on any `pageerror`.
`E2E_HEADED_GPU=1` runs it in headed Chrome on WebGPU.
