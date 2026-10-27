# Big-canvas performance, 2026-10-27

Fixture: copy of the 63-node / 10-connection / 200-asset heavy canvas in test@dazero.co's org (`scripts/perf/copy-heavy-canvas.mjs`). Dev server (vite dev), headed Chrome stable on the real GPU (macOS, Metal), viewport 1440x900, fresh browser context per run (cold HTTP cache, warm Vite), signed in. Reproduce: `node --env-file=.env scripts/perf/copy-heavy-canvas.mjs`, `npx vite dev --port 5188`, then `PERF_BASE=http://localhost:5188 npx vite-node scripts/perf/big-canvas.ts` and `scripts/perf/report.ts`.

Median of 3 runs per column. `default` = the shipped renderer, `webgpu` = `?renderer=webgpu`; `x1` = no throttle, `x4` = CPU throttle 4x.

| metric | default-x1 | default-x4 | webgpu-x1 | webgpu-x4 |
| --- | --- | --- | --- | --- |
| DOM nodes present (ms) | 2567 | 4435 | 2507 | 4038 |
| first painted node (ms) | 2567 | 4435 | 2507 | 4038 |
| FCP (ms) | 2524 | 4056 | 2140 | 3972 |
| no blank nodes (ms) | 2891 | 4435 | 3111 | 5043 |
| blank nodes at first paint | 0 | 0 | 0 | 0 |
| blank nodes once settled | 0 | 0 | 0 | 0 |
| JS heap after load (MB) | 114 | 114 | 72 | 72 |
| JS heap peak (MB) | 217 | 238 | 149 | 149 |
| long tasks (count) | 23 | 144 | 2 | 11 |
| long tasks (total ms) | 13143 | 37606 | 347 | 2284 |
| panFit fps median | 60 | 39 | 60 | 59 |
| panFit fps p5 | 54 | 20 | 54 | 54 |
| panFit frame p95 (ms) | 18.6 | 51.1 | 18.5 | 18.5 |
| panFit worst frame (ms) | 50.9 | 68.3 | 18.7 | 34.2 |
| panFit frames >33 ms | 2 | 47 | 0 | 0 |
| zoom fps median | 60 | 37 | 60 | 60 |
| zoom fps p5 | 54 | 10 | 54 | 54 |
| zoom frame p95 (ms) | 18.5 | 97.9 | 18.4 | 18.4 |
| zoom worst frame (ms) | 33.3 | 132.6 | 18.7 | 18.7 |
| zoom frames >33 ms | 0 | 33 | 0 | 0 |
| panZoomed fps median | 19 | 20 | 60 | 60 |
| panZoomed fps p5 | 7 | 12 | 54 | 55 |
| panZoomed frame p95 (ms) | 148 | 82.5 | 18.6 | 18.3 |
| panZoomed worst frame (ms) | 1782 | 1833.2 | 18.7 | 18.7 |
| panZoomed frames >33 ms | 7 | 21 | 0 | 0 |

Flashes (painted node turning blank again during load), per run: default-x1: 0/0/0; default-x4: 0/0/0; webgpu-x1: 0/0/0; webgpu-x4: 0/0/0

## CPU profile, self time during the three sweeps (one profiled run per column)

**default-x1**

| self time | % | function |
|---|---|---|
| 2771 ms | 27 | `submit :-1` |
| 587 ms | 6 | `<vello_encoding[97bf4480efdea691]::path::PathEncoder>::is_zero_length_segment gpu-core/gpu_core_bg.wasm:0` |
| 486 ms | 5 | `createBindGroup :-1` |
| 342 ms | 3 | `<dlmalloc[8627653fc6e0bd47]::dlmalloc::Dlmalloc<dlmalloc[8627653fc6e0bd47]::sys::System>>::malloc gpu-core/gpu_core_bg.wasm:0` |
| 218 ms | 2 | `<dlmalloc[8627653fc6e0bd47]::dlmalloc::Dlmalloc<dlmalloc[8627653fc6e0bd47]::sys::System>>::insert_large_chunk gpu-core/gpu_core_bg.wasm:0` |
| 214 ms | 2 | `writeBuffer :-1` |
| 196 ms | 2 | `<alloc[42d2b33bd937efdb]::vec::Vec<alloc[42d2b33bd937efdb]::vec::Vec<f64>> as core[37ee0ce0c4cd57d5]::clone::Clone>::clone gpu-core/gpu_core_bg.wasm:0` |
| 193 ms | 2 | `(garbage collector) :-1` |
| 184 ms | 2 | `<vello_encoding[97bf4480efdea691]::path::PathEncoder>::path_elements::<core[37ee0ce0c4cd57d5]::iter::adapters::copied::Copied<core[37ee0ce0c4cd57d5]::slice::iter::Iter<kurbo[b0eb459b40b1be09]::bezpath::PathEl>>> gpu-core/gpu_core_bg.wasm:0` |
| 172 ms | 2 | `__wbg_createBindGroup_f539b26ca341308f gpu-core/gpu_core.js:522` |
| 159 ms | 2 | `__rustc[3d2f79520d6fa809]::__rdl_realloc gpu-core/gpu_core_bg.wasm:0` |
| 151 ms | 1 | `<vello_encoding[97bf4480efdea691]::path::PathEncoder>::line_to gpu-core/gpu_core_bg.wasm:0` |
| 149 ms | 1 | `core[37ee0ce0c4cd57d5]::num::imp::flt2dec::strategy::grisu::format_shortest_opt gpu-core/gpu_core_bg.wasm:0` |
| 120 ms | 1 | `changed core/use-diff.ts:7` |
| 113 ms | 1 | `<dlmalloc[8627653fc6e0bd47]::dlmalloc::Dlmalloc<dlmalloc[8627653fc6e0bd47]::sys::System>>::free gpu-core/gpu_core_bg.wasm:0` |

**default-x4**

| self time | % | function |
|---|---|---|
| 3056 ms | 11 | `createBindGroup :-1` |
| 1276 ms | 4 | `__wbg_createBindGroup_f539b26ca341308f gpu-core/gpu_core.js:522` |
| 1224 ms | 4 | `submit :-1` |
| 961 ms | 3 | `<vello_encoding[97bf4480efdea691]::path::PathEncoder>::is_zero_length_segment gpu-core/gpu_core_bg.wasm:0` |
| 917 ms | 3 | `<dlmalloc[8627653fc6e0bd47]::dlmalloc::Dlmalloc<dlmalloc[8627653fc6e0bd47]::sys::System>>::malloc gpu-core/gpu_core_bg.wasm:0` |
| 731 ms | 3 | `core[37ee0ce0c4cd57d5]::num::imp::flt2dec::strategy::grisu::format_shortest_opt gpu-core/gpu_core_bg.wasm:0` |
| 644 ms | 2 | `beginComputePass :-1` |
| 585 ms | 2 | `writeBuffer :-1` |
| 528 ms | 2 | `<dlmalloc[8627653fc6e0bd47]::dlmalloc::Dlmalloc<dlmalloc[8627653fc6e0bd47]::sys::System>>::insert_large_chunk gpu-core/gpu_core_bg.wasm:0` |
| 476 ms | 2 | `changed core/use-diff.ts:7` |
| 469 ms | 2 | `<core[37ee0ce0c4cd57d5]::hash::sip::Hasher<core[37ee0ce0c4cd57d5]::hash::sip::Sip13Rounds> as core[37ee0ce0c4cd57d5]::hash::Hasher>::write[1] gpu-core/gpu_core_bg.wasm:0` |
| 399 ms | 1 | `wasm-to-js :0` |
| 391 ms | 1 | `createView :-1` |
| 379 ms | 1 | `<std[d775520e4a0009e6]::hash::random::RandomState as core[37ee0ce0c4cd57d5]::hash::BuildHasher>::hash_one::<&vello[5d110786903e7124]::recording::ResourceId> gpu-core/gpu_core_bg.wasm:0` |
| 375 ms | 1 | `<alloc[42d2b33bd937efdb]::string::String as core[37ee0ce0c4cd57d5]::fmt::Write>::write_str[6] gpu-core/gpu_core_bg.wasm:0` |

**webgpu-x1**

| self time | % | function |
|---|---|---|
| 273 ms | 12 | `get deps/chunk-RXV2A6KJ.js?v=b0842b01:4651` |
| 184 ms | 8 | `get deps/chunk-RXV2A6KJ.js?v=b0842b01:4364` |
| 175 ms | 8 | `(anonymous) [canvasId]/+page.svelte?t=1793094130879:6235` |
| 123 ms | 5 | `(anonymous) [canvasId]/+page.svelte?t=1793094130879:6223` |
| 90 ms | 4 | `mark_reactions deps/chunk-RXV2A6KJ.js?v=b0842b01:2275` |
| 89 ms | 4 | `is_dirty deps/chunk-RXV2A6KJ.js?v=b0842b01:4093` |
| 89 ms | 4 | `(garbage collector) :-1` |
| 85 ms | 4 | `traverse_fn deps/chunk-RXV2A6KJ.js?v=b0842b01:3036` |
| 69 ms | 3 | `(anonymous) gpu/GpuFlow.svelte?t=1793094130879:5878` |
| 63 ms | 3 | `(anonymous) [canvasId]/+page.svelte?t=1793094130879:6224` |
| 51 ms | 2 | `strict_equals deps/chunk-RXV2A6KJ.js?v=b0842b01:4892` |
| 38 ms | 2 | `schedule deps/chunk-RXV2A6KJ.js?v=b0842b01:2871` |
| 34 ms | 1 | `appendChild :-1` |
| 31 ms | 1 | `set gpu/chrome-layer.ts:32` |
| 27 ms | 1 | `(anonymous) motion/MotionPreview.svelte:193` |

**webgpu-x4**

| self time | % | function |
|---|---|---|
| 945 ms | 13 | `get deps/chunk-RXV2A6KJ.js?v=b0842b01:4651` |
| 629 ms | 8 | `get deps/chunk-RXV2A6KJ.js?v=b0842b01:4364` |
| 511 ms | 7 | `(anonymous) [canvasId]/+page.svelte?t=1793094130879:6235` |
| 360 ms | 5 | `is_dirty deps/chunk-RXV2A6KJ.js?v=b0842b01:4093` |
| 350 ms | 5 | `(anonymous) [canvasId]/+page.svelte?t=1793094130879:6223` |
| 285 ms | 4 | `traverse_fn deps/chunk-RXV2A6KJ.js?v=b0842b01:3036` |
| 266 ms | 4 | `mark_reactions deps/chunk-RXV2A6KJ.js?v=b0842b01:2275` |
| 252 ms | 3 | `(anonymous) gpu/GpuFlow.svelte?t=1793094130879:5878` |
| 197 ms | 3 | `(garbage collector) :-1` |
| 185 ms | 2 | `strict_equals deps/chunk-RXV2A6KJ.js?v=b0842b01:4892` |
| 178 ms | 2 | `(anonymous) [canvasId]/+page.svelte?t=1793094130879:6224` |
| 160 ms | 2 | `schedule deps/chunk-RXV2A6KJ.js?v=b0842b01:2871` |
| 133 ms | 2 | `updateTransformAndChildren deps/chunk-GJPQUPGH.js?v=b0842b01:746` |
| 115 ms | 2 | `appendChild :-1` |
| 100 ms | 1 | `(anonymous) motion/MotionPreview.svelte:193` |

## Bottlenecks (from the profiles above)

1. **Default renderer, zoomed in (74%, mix of image/text/social nodes): 19 fps median, p5 7 fps, worst frame 1.8 s, unthrottled.** Zoomed-out it holds 60. At 4x throttle the default renderer drops to ~37-39 fps even zoomed out (p5 10-20 fps, 144 long tasks / 37.6 s). Profile: `GPUQueue.submit` is 27% of self time unthrottled; `createBindGroup` (+ its wasm shim `__wbg_createBindGroup`) is 11% + 4% throttled; the rest is the vello scene encoder in the gpu-core wasm (`PathEncoder::is_zero_length_segment`, `path_elements`, `line_to`, malloc/realloc, `Vec<Vec<f64>>::clone`, float formatting, SipHash of `ResourceId`). The scene is re-encoded and rebound every frame instead of reused.
2. **WebGPU (GpuFlow) path: Svelte reactivity in the per-tile overlay.** 60 fps everywhere unthrottled and 59-60 at 4x, but the main thread is mostly reactive reads: `get` + `is_dirty` + `mark_reactions` + `traverse_fn` (about 30% of self time) and the `tileOver` snippet in `src/routes/p/[projectId]/c/[canvasId]/+page.svelte` (lines 4045-4048: four `{@const}` per tile, two of them `nodes.find(...)` over all 63 nodes, so O(n^2) per update) at ~12% (+ `GpuFlow.svelte:3475`, the snippet call). It scales with node count and is what limits the phone-class headroom (long tasks 2 -> 11, worst frame 34 ms at 4x).
3. **Default renderer long tasks at load: 23 long tasks / 13.1 s total unthrottled, 144 / 37.6 s at 4x** (webgpu: 2 / 0.35 s and 11 / 2.3 s). Same wasm encoder cost, paid while sweeping and while loading; JS heap peaks 217-238 MB vs 149 MB for webgpu. Load itself is comparable (first node painted 2.5 s unthrottled, ~4.0-4.4 s at 4x).

Other findings: no blank or flashing nodes were detected on warm loads in any column (0 flat nodes at first paint, once settled, and 0 flashes). Blank placeholder nodes were seen only on the very first load after the dev server started (Vite compiling on demand): see `cold-first-load-*.png` in the results folder. That is a dev-server effect, not a product measurement.

## Limits of the method

- Vite dev, not a production build: unminified Svelte dev runtime (`add_svelte_meta`, `$.tag`) inflates the JS cost of path 2; the wasm/GPU numbers of path 1 should carry over. A production-build rerun is the first follow-up.
- 4x CPU throttle only slows the main thread. The GPU, the network and memory bandwidth are untouched, so it is a lower bound for a phone, not a phone.
- Headed Chrome on a 60 Hz display: frame times are rAF gaps, capped at 16.7 ms; fps cannot exceed 60. `over33` counts gaps above 33 ms.
- Sweeps are synthetic wheel events (6 s each): pan at fit zoom (7%), a ctrl-wheel zoom in/out cycle, pan at 50% target zoom around the node centroid (landed at ~74%). The zoomed view shows mostly image/text/social nodes, not the 32 motion frames.
- Blank-node detection is screenshot based: a node counts as blank when its box is the colour of the canvas background with no variance. An unpainted node that is white, or a painted node that matches the background, is misjudged. 6 px minimum box size, polled every 400 ms; screenshots add load, most visibly at 4x, so load timings are slightly pessimistic. Flashes are only counted during load, not during the sweeps.
- Heap numbers: `HeapProfiler.collectGarbage` + `Runtime.getHeapUsage` after load; peak is a 250 ms sample of `performance.memory`. GPU memory is not measured.
- Profiles: one profiled run per column (1 ms sampling, three sweeps), not a median; sampling perturbs timings. Self time only; GPU-process time is invisible, so `submit` is the JS-side cost of the call.
- The fixture is a copy of a canvas made on 2026-10-27; assets are copied (183 files), signed URLs inside node data were not regenerated. Single machine, single run day.
