# Retained screen for `?renderer=core`

Before: every pan/zoom frame rebuilt `screenUses`, sent the whole scene as JSON, re-placed every
group item and vello re-rasterised the full screen.

Now the core keeps the last composited screen (`retained.rs`, `compositor.rs`):

- TS sends world-space uses as diffs (`use-diff.ts`), the overlay only when it changes, and
  `setCamera` every frame.
- Camera-only change inside the overscan (min(w,h)/8, ≤ 128 px): one reprojected quad, no raster.
- Pan past it: camera snapped to device pixels, old texture shifted, only uncovered strips
  rastered; the new texture leads by the overscan in the pan direction.
- Edits: damage = old+new bounds of changed uses, changed overlay items, groups whose picture or
  cache changed; merged to ≤ 8 rects; > 60 % of the view = full render.
- Zoom: reprojection during the gesture, refine after 100 ms idle, quarter resolution first when
  the last full render took > 12 ms.
- Each frame reports idle/reused/partial/full (`data-painted` on the core canvas).

WebGPU (`reproject.rs`) and WebGL2 (`gl_reproject.rs`, regions tiled to the canvas size). Native
renders one-shot frames and does not use it.

Bench (`scripts/bench/canvas-core.ts`, now with a zoom gesture and p95) still shows core behind
gpu on worst frame; remaining time is GPU-side strip/partial rasters, measured under load > 6.
