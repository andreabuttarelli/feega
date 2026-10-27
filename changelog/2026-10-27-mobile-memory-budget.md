# Mobile memory budget for the core renderer

The canvas crashed on iPhone after a while of smooth panning: WebKit kills a tab past ~1–1.5 GB. Measured with `scripts/perf/mobile-memory.ts` (Chrome, 390x844 at DPR 3, 5 min pan/zoom on the heavy canvas): textures created and never destroyed grew without bound, 13k textures / ~24 GB awaiting GC. wgpu's WebGPU backend drops are no-ops, so every per-tile scratch texture, unshelved pool texture, evicted raster and per-pass param buffer waited for GC.

Changes:
- gpu-core destroys the per-tile scratch, unshelved pool textures, evicted/replaced rasters, replaced pictures and filter param buffers.
- Pictures are freed when no put group shows them (`forget_picture`), with their ImageBitmap closed.
- WebGPU pictures are decoded to the budget's side (phone 2048, desktop 4096), like WebGL already was.
- One budget table (`memory-budget.ts`) picks resolution, picture side and texture bytes; `navigator.deviceMemory <= 4` gets the phone budget.
- A lost device / GL context reattaches the core instead of leaving a dead canvas.
- `?coreDebug` exposes `window.__gpuMem`.

Not done: off-screen video pause/release (no video in the measured canvas), downscale to on-screen size (side cap instead).
Results: `scripts/perf/results/2026-10-27-mobile-memory.md`.
