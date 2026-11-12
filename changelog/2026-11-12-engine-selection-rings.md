# Selection, handles and hover drawn by the engine (ADR 0037 step 1a)

Before: the hover ring and `FrameSelection` (element, group, multi-select) were DOM, repositioned
from `view` every frame; node rings and handles were world-space overlay items re-sent only outside
gestures, so they scaled with the retained screen during a zoom.

Now, on the WebGPU core, `marks.rs` holds world quads plus look (sent by `set_marks` only when they
change) and rebuilds screen-space rings and handles at the current camera every frame, on the tiles
and exact paths. `hit(x, y)` and `rect_of(i)` answer from the same geometry: GpuFlow routes presses
on handles, edges, rotate zones and bodies to the old `grab`/`grabMany`, node resize hit-testing goes
through `hit`, and the rename input sits at `rect_of`.

Kept: the DOM overlay for WebGL and `coreOff` (ADR: until a green week), and the pivot dot in the
DOM. e2e reads selections through `window.__gpuCanvas.marks` via `tests/e2e/fixtures/canvas-marks.ts`.
