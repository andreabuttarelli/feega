# Core renderer, atlas copies and overlay resend, 2026-10-27

Fixture: heavy canvas copy in the test org (project f0052fa8, canvas a729ae34), 74% zoomed state (`PERF_ZOOM=0.74`), headed Chrome 156, 1440x900, median of 5, production build, core renderer only (`PERF_ONLY=default`). Before = #1413 head. After = this branch.

| metric | before x1 | after x1 | before x4 | after x4 |
| --- | --- | --- | --- | --- |
| no blank nodes (ms) | 2808 | 2995 | 4352 | 4073 |
| long tasks (total ms) | 1018 | 1135 | 7339 | 7122 |
| panFit fps median | 55 | 60 | 54 | 59 |
| panFit fps p5 | 56 | 56 | 57 | 57 |
| panFit frames >33 ms | 3 | 0 | 3 | 3 |
| zoom fps median | 60 | 60 | 57 | 56 |
| zoom fps p5 | 57 | 56 | 30 | 30 |
| zoom frames >33 ms | 0 | 0 | 1 | 4 |
| panZoomed fps median | 45 | 60 | 46 | 58 |
| panZoomed fps p5 | 29 | 56 | 30 | 57 |
| panZoomed frame p95 (ms) | 34.2 | 17.7 | 33.5 | 17.6 |
| panZoomed worst frame (ms) | 450.4 | 17.8 | 399.9 | 116.6 |
| panZoomed frames >33 ms | 12 | 0 | 11 | 3 |

Trace attribution, panZoomed x4, frames over 33 ms (`PERF_TRACE=1`, `scripts/perf/trace-frames.ts`)

| cause | before | after |
| --- | --- | --- |
| frames > 33 ms | 18 (1730 ms) | 4 (395 ms) |
| main thread idle, GPU process in `Queue::Submit` | 72% | 0% |
| native calls (submit, createBindGroup) | 13% | 62% |
| JS (`changed`, chunks) | 6% | 7% |
| wasm (SipHash, float formatting) | 6% | 31% |
| GC | 3% | 0% |
| `Queue::Submit` total / max | 1863 ms / 100 ms | 426 ms / 9 ms |

A Metal System Trace of the same sweep showed blits (vello atlas copies) as most of Chrome's GPU time: every render re-copied every drawn picture.

Findings
- panZoomed x4: p5 30 -> 57, worst frame 400 -> 117 ms. Goal met.
- zoom x4 p5 stays 30: now main-thread bound (createBindGroup 366 ms, wasm, overlay resend when the hover ring changes with zoom). Not met.
- No-blank time and long tasks: within run-to-run noise.
- Pixels: settled fit and zoomed views differ by more than 24/255 in 0.001% / 0% of pixels.
- Earlier "60 fps" numbers in this session were the fallback renderer (wasm swapped under a running preview); the harness now throws on `core off`.
