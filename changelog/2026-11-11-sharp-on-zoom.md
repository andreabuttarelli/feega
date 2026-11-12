# Canvas: tiles sharpen during the zoom, not after it

Before, a zoom level reached mid-gesture stayed blurry until the gesture ended: tiles within one
doubling of a held level were never queued, during a gesture only one blurry and one stale tile
could bake per frame, and the sharp picture came from the exact rest raster, which waits for the
JS gesture end (150 ms of quiet) plus `REST_AFTER_MS` (200 ms). The user saw UIs sharpen late on
every zoom in.

Now `Tiles::queue` puts every visible tile at the current level that no sharper held level shows
into the queue, and `Queue::order` gives one order for all of them: blank, then blurry
centre-out, then stale. `tiled_frame` bakes that order under the frame budget, during a gesture
one tile per batch (`gesture_batches`) so a frame never waits on a 2×2 block; at rest the 2×2
blocks stay. `one_at_a_time` and `must` are gone. A `RasterCredit` replaces "at least one batch
per frame": each frame earns its budget (never banked beyond one frame), each tile spends what it
took, so a 15 ms tile is followed by idle frames instead of by another 15 ms tile.

The core reports its zoom step per frame, and the gesture bench reports, per level change, the
time until nothing visible is unsharp (`levelSharpP50/P95`, plus levels left before they
sharpened). `BENCH_DUMP=1` writes per-frame counters; the CPU profile now runs through settling.

What still misses the bar: one tile costs 7–15 ms of CPU at mid zoom, almost all in
`prepare_items` (layer bodies, backdrops, masks, shadow filters, one vello render and buffer
upload per layer per tile, and a `Debug`-formatted cache key that never hits across tiles). So a
level of ~80–100 tiles needs ~1 s of raster, and the 50 ms target needs layers rendered once per
level and reused by every tile they cross. The rest-picture timers still gate settling, not
sharpness.
