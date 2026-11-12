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

Merged for correctness: on dev the rings lagged the element by up to 38 device px mid-zoom
(`tests/perf/ring-drift.spec.ts`). The element hover outline (`frame-pick-box`, layer hover) is now an
engine mark too. The DOM fallback reads the camera the GPU frame presented (`onpresent`), not `view`,
which removed the same lag on WebGL. Rotation, pivot and edge DOM zones are not exposed by `rect_of`:
specs needing them still read the DOM and only run where the engine draws no marks.
