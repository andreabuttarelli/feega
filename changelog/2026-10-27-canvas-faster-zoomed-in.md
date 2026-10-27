# Zoomed-in panning on the core canvas: masks as clips, nothing off screen

The big-canvas harness (`scripts/perf/big-canvas.ts`) measured the default renderer at 19 fps while panning zoomed in, worst frame 1.8 s, with `GPUQueue.submit` at a quarter of the main thread.

Cause: two imported SVG frames carry about 600 masked paths each (SVG clip-paths: `intersect`, level 1, no feather, a path cover). A masked item was a layer: its own texture, a vello render and a queue submit. `prepare_items` made one for every masked item of every group on screen, including those nowhere near the strip or tile being painted, and `Library::plan` cloned all of them first. Zoomed out they are Skip-level; zoomed in the whole frame is on screen. Zooming into the frame was worse (up to 24 s of `submit`): the cached texture of the group rebuilds every zoom step, 600 layers each time.

Now:

- A mask list that only intersects hard path covers (the first may be `add`) is not a layer: `clip_covers` in `scene.rs` draws the item inside nested clips. A pixel test against the layered rendering pins the parity. Feathered, inverted, partial-level, subtract, picture and ramp masks, mattes, blur, filters and backdrops still make a layer.
- `prepare_items` records an item whose reach (bounds plus blur, feather and filter margins) misses the frame in `Layers::culled` and makes no layer for it; `build_items` skips it without reporting a skipped layer.
- `Library::plan` drops group items that cannot reach the screen before placing (cloning) them, for uncached uses only, never for groups holding a lens, never for items with filters or backdrops.
- `plan` hands the screen list and the rasters on by value instead of cloning them again.
- `tileOver` and `tile` in the canvas page read a `Map` by id (`byId`) instead of `nodes.find` per tile.

Discarded: raising `KEPT_LAYERS` / hashing the layer cache key. The key holds the item matrix and the tile size, which change every pan step, so the cache does not hit while panning.

Not done: the first appearance of a heavy vector frame still pays its lazy encode (about 250 ms, once per group).
