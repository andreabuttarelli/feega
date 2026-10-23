# Pencil tool

Freehand drawing: `DrawTool.Pencil` collects pointer samples in `DrawOverlay`, `smoothStroke`
(`shape/pencil.ts`) simplifies them (Ramer-Douglas-Peucker, tolerance 2 screen px converted to doc
px) and gives interior vertices Catmull-Rom handles. Holding Shift draws a straight segment snapped
to 45 degrees (`straightStroke`). The result is an open stroked path made by `penClip`, so GPU
canvas and export treat it like any pen path.

Shortcut Shift+B (Shift+P is taken by the pen). Parity: declared as `set_path`.

Verified in a real browser: `tests/e2e/canvas-pencil.spec.ts`. The frame must be selected first,
otherwise the stroke becomes a free canvas element.
