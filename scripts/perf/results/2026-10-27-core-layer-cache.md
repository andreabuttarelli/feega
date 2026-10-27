# Core renderer, layer-body cache attempt, 2026-10-27

Fixture: heavy canvas copy in the test org (project f0052fa8, canvas a729ae34), 74% zoomed state (`PERF_ZOOM=0.74`), headed Chrome, 1440x900, median of 3, production build, core renderer only (`PERF_ONLY=default`). The webgpu renderer is not compared: it is being removed.

Before = #1406. After = glyph-layout memo plus a translation-invariant layer-body cache in gpu-core. The gpu-core change is NOT in this PR (see below), so the after column below measures both and is the evidence for dropping it.

| metric | before x1 | after x1 | before x4 | after x4 |
| --- | --- | --- | --- | --- |
| no blank nodes (ms) | 2097 | 2989 | 3526 | 5622 |
| long tasks (total ms) | 990 | 910 | 6499 | 7605 |
| panFit fps median | 57 | 56 | 56 | 52 |
| panFit fps p5 | 56 | 57 | 57 | 56 |
| panFit frames >33 ms | 2 | 3 | 3 | 5 |
| zoom fps median | 59 | 60 | 55 | 57 |
| zoom fps p5 | 56 | 57 | 30 | 31 |
| zoom frames >33 ms | 1 | 0 | 6 | 0 |
| panZoomed fps median | 47 | 47 | 48 | 42 |
| panZoomed fps p5 | 30 | 29 | 29 | 20 |
| panZoomed frame p95 (ms) | 33.3 | 34 | 33.9 | 49 |
| panZoomed worst frame (ms) | 349 | 334 | 266 | 417 |
| panZoomed frames >33 ms | 10 | 13 | 13 | 13 |

Findings
- On this canvas the profile is flat (no single hot function; page-side `changed`, GC, SipHash in `Groups::get`). `createBindGroup` is 2% self time, not the 11% seen on the earlier canvas, so layer bodies are not the bottleneck here.
- The layer cache (patch kept outside the repo) made `a_layer_panned_by_whole_pixels_is_reused` pass and rendered pixel-identically, but panZoomed x4 got no better (42 vs 48 fps, p5 20 vs 29). Dropped, not shipped.
- Screenshots before/after: zoomed state differs by more than 24/255 in 0.05% of pixels (fps overlay).
- Core does not reach 60 fps on panZoomed at x4 (p5 29). Default renderer must not be switched.
