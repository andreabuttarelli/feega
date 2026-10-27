# Core canvas: overlay and mixed groups composed from encodings

Follow-up to #1405 (branch `perf/core-path-cache`, depends on it) and to the harness of #1396.

Profile of the core renderer at 4x CPU zoomed in (74%): wasm `WebCore::frame` was 8.3 s of 23 s, 70% of it vello path encoding (`PathEncoder`, `polygon`, `Vec<Vec<f64>>::clone`). The suspect from the earlier notes was the two imported SVG frames. The profile and a dump of what the wasm module receives said otherwise for most of it: the world overlay (153 chrome and label paths, 57k points, 2 MB of JSON) was cloned by `World::screen` and cloned again by `Library::plan` for every region, then re-encoded.

What changed:

- The overlay is a library group (`overlay:`), placed by a camera `Use`. It is encoded once per `set_overlay`, composed with a transform afterwards. `World::overlay_group` shifts its items to a local origin; with no encodable overlay (non-path items) the old clone path stays.
- A group no longer needs to be all vector to benefit. `Cast` splits the item list into spans of plain vector items (encoded, composed) and loose items (placed as before, with bounds measured once instead of per frame). A group item that needs a layer (blur, filters, soft masks) keeps its look and its layer, and its children are spans again. `UseItem.reach` gives those nested uses bounds, so the layer region stays right. Groups that were fully vector keep their single fragment keyed by the group name.
- `prepare_items` passes the fragments to nested groups.
- The layer cache key is the `Debug` text of the item; for a group of 10k points that was formatting 10k floats on every plan. Items over 1000 points are not keyed (redrawn instead).
- `World::same` compares paints with `PartialEq` instead of formatting them.

Considered and dropped: warming encodings while idle. `plan` already encodes every group the world holds on its first frame; the lazy part is the page creating the group list, not the encode (native encode of the 1.5 MB groups is 2.5 ms, parse 13 ms).

What remains: layer bodies (blur, filters, masks) are still re-rendered per strip while panning zoomed in, and zooming still re-rasterises everything (GPU passes and bind groups dominate the remaining frames), and the page recomputes card layout and chrome text when nodes enter the view.

Numbers: `scripts/perf/results/2026-10-27-core-overlay-cast.md`.
