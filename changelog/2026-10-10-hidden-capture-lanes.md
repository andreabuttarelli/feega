# Capture lanes hidden in WebKit

WebKit spent ~450 ms of every exported frame painting the live lane page (DOM, filters, WebGL
canvases) — work nobody looks at, since frames come from html-to-image clones and in-lane
bitmaps. The stall landed on the first GPU round-trip of the next shot (createImageBitmap,
texImage2D, rAF), which is why the earlier probes blamed 3D readback and DOM raster sheets.
Instrumented: raster sheets are all cache hits after frame 1 (0 ms); 600 ms of idle between
shots made the stall vanish; `visibility: hidden` on the lane removes it.

- `laneVisibility(engine)` (`lanes.ts`): WebKit `hidden`, other engines `visible`.
- `mountCapturePlayer` applies it to every extra lane; `MotionPreview` applies it to the preview
  player while it is borrowed for capture (Safari exports on that single lane), so the preview
  goes black in Safari during an export.
- Chromium stays visible: it stops rAF in a hidden cross-origin iframe, so `Settle.Paint` (and
  `Settle.Seek` with videos) would hang.
- Discarded: `opacity: 0` (still paints, no gain); antialias off, shadows off, pixel ratio 0.25
  (no change: not GPU fill); skipping encode or composite (no change).

Bench (24 f, 1 lane, `--layering=gpu`, 3 interleaved runs, median ms/frame): see PR. Output
pixel-identical (PSNR inf, WebKit and Chromium).
