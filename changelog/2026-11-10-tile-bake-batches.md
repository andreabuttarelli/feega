# Tiles: idle baking in 3×3 blocks, vello buffer pool 16

Behind `?coreTiles`. Warm-up and reserve rastered tiles one at a time; each render paid vello and
WebGPU setup (`createBuffer`, `createView`) and re-rendered every layer body (blur, mask,
backdrop) it touched. Idle baking now renders 3×3 blocks (`bake_batches`, 772 px, under the
1024 px render cap of #1063); gestures keep 2×2 (`batches`). Vello keeps 16 buffers per kind
instead of 2 (misses re-created buffers every render).

Measured with a probe (branch `proto/mip-bake`), landings, CPU 1x, zoom 1.5, one screen of tiles:
CPU 307 → 107 ms (3×3), +4 level 1359 → 1011 ms; pool 16 on top of 4×4: +4 level 944 → 640 ms.
GPU time is then the limit (~2.9 ms per tile). Probe screenshots of 3×3 tiles vs 2×2: 0 pixels
differ at zoom 0.12/0.5/1.5/4; 4×4 differed in 0.02% at 0.12, so not used.

Discarded: 3×3 for gesture rasters too. Gesture A/B, 3 interleaved: zoom 56–57 → 44–47 fps and
p95 18.5 → 48–51 ms in 2 of 3 runs (a bigger block overruns the 4 ms frame budget).
