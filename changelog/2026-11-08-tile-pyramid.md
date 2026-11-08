# World tile pyramid behind `?tiles=1` (WebGPU only)

Before: the retained renderer re-rasters the whole viewport when zoom changes; on the heavy canvas a
zoomed-in redraw costs 200–450 ms (#1835).

- **`tile_pyramid.rs`**: world tiles of 512 px (+2 px gutter) keyed by (zoom, tx, ty). During a
  gesture the target zoom is the power of two at or above the camera zoom; 100 ms after zoom stops
  it is the exact zoom, so a settled tile is one texel per pixel. Missing tiles are drawn from the
  nearest cached zoom; with no stand-in they render in the same frame. Edits drop only the tiles
  they touch, at every zoom. LRU against a byte cap, never evicting a tile used this frame.
- **`Compositor::frame_tiles`**: at most 4 tiles or ~4 ms per frame (at least one), keeps asking
  for frames until settled. Pan only composites.
- **`plan_part(.., Unseen::Keep)`**: planning per tile evicted groups other tiles still use.
- **Zero-area damage**: a node's first damage rect can have no area; `invalidate` now uses an
  inclusive overlap, else stale empty tiles stay (the canvas painted blank).
- In tile mode the group cache budget is split half and half with tiles.

Flag: `?tiles=1` (`raster-mode.ts`). Default stays retained; WebGL and native ignore it.

Open before making it default: overlay/video baked into tiles (selection and video frames
invalidate them); the reprojector allocates a uniform buffer + bind group per tile draw (Safari GPU
memory, see LESSONS.md); 4 ms budget is CPU time, not GPU; WebGL path not wired.

Probe: `tests/e2e/canvas-tile-pyramid-probe.spec.ts` (Chromium desktop and 4x, WebKit), including a
zoomed-in zoom gesture.
