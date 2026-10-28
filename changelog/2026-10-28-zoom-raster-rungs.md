# Zoom re-rasters cached frames per rung, one per frame

iPhone Safari tab died on every fast pinch-zoom (and fast pan) on heavy canvases, after #1447 and #1454.

Before: a cached frame texture was re-rastered whenever zoom drifted past 2% (`SHARPEST`) — every frame of a fast pinch — at a new, never-repeating size. The compositor called `Library::plan` once per 1024 px tile, and the "1 raster per draw" limit applied per tile, so one frame could raster several frames. Result: continuous allocate-then-destroy of large textures of fresh sizes, faster than the GPU process frees them.

Now:
- cache scales snap up to a ladder of 4 rungs per doubling (`rung` in `groups.rs`); a texture stays fresh from its rung down to one rung below. Never blurrier than screen, at most 1.19x oversampled. Sharpening stays progressive, one step per rung.
- the raster budget is per frame across tiles (`compositor.rs`).

Measured with a counting painter (12 cached 600 px frames, iPhone-size target, 6 bursts of 0.3x→1.2x→0.3x, 228 frames): rasters 454 → 210, texture bytes allocated 314 MB → 189 MB, rasters per frame 1.99 → 0.92.

Not verified on a real device: the iOS 26.4 simulator exposes `navigator.gpu` but returns no adapter, so gpu-core cannot run there. Discarded: per-device cache byte budget in Rust (TS `cached()` already budgets at current zoom).
