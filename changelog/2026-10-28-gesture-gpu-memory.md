# Less GPU churn during fast gestures

iPhone Safari still died on fast pinch-zoom after #1447, #1454, #1499.

Now (gpu-core):
- `Library::set_motion(Motion::Gesture)` (JS sends it each paint): zoom out reuses the sharper held texture; zoom in re-rasters one group, on screen, nearest the tile centre, a group already building first. Off-screen groups wait for rest. At rest the old per-rung behaviour returns, so zoom still sharpens progressively.
- WebCore starts a new gesture raster at most every 80 ms; chunks of a build in progress continue each frame.
- `set_budget` (phone 128 MB, desktop 256 MB from `memory-budget.ts`): over budget, held textures more than 4096 px off the tile go first, farthest first; off-screen groups are not rastered ahead when they would not fit.
- Engine keeps up to 4 released cache textures and reuses one of the same size; a raster that does not read its own clip frees the old texture before drawing. Chunked builds ping-pong two textures instead of creating one per chunk.
- The per-tile scratch texture is kept across frames instead of created and destroyed per tile.

Not done:
- DPR: already clamped to 2 by `BUDGET.resolution`.
- Batching submits: vello's `render_to_texture` submits internally per call (each layer, each raster); one encoder per frame needs a vello fork or its lower-level recording API. Not feasible without a renderer rewrite.

Measured with `examples/burst_cost.rs` (3 frames 1440x4480, 1170x2532 screen, 6 bursts 0.3x→1.2x→0.3x at 60 fps): rasters 360 → 108, raster texture bytes 3121 MB → 1124 MB, peak held 30 → 33 MB. `scripts/perf/fast-burst.ts` could not run: the local `.env` database does not have the heavy canvas (blank page); it now also reports textures created and drawing buffer size.
