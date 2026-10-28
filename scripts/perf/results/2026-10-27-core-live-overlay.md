# Core renderer, live overlay split, 2026-10-27

Fixture: heavy canvas copy in the test org (project f0052fa8, canvas a729ae34), 74% zoomed state (`PERF_ZOOM=0.74`), headed Chrome 156, 1440x900, production build, core renderer only (`PERF_ONLY=default`). Before = #1429 head (1bb99a491). After = this branch. Median of 5 runs, run as alternating before/after pairs because machine load averaged 20-40 (other agents); one after x4 run hung and was dropped (4 runs).

| metric | before x1 | after x1 | before x4 | after x4 |
| --- | --- | --- | --- | --- |
| no blank nodes (ms) | 3042 | 2706 | 3332 | 4867 |
| long tasks (total ms) | 1388 | 1290 | 6789 | 8108 |
| panFit fps median | 60 | 60 | 60 | 60 |
| panFit fps p5 | 56 | 56 | 56 | 57 |
| panFit frames >33 ms | 0 | 0 | 1 | 1 |
| zoom fps median | 45 | 46 | 56 | 56 |
| zoom fps p5 | 20 | 20 | 31 | 30 |
| zoom frames >33 ms | 36 | 34 | 2 | 15 |
| panZoomed fps median | 60 | 60 | 59 | 59 |
| panZoomed fps p5 | 56 | 56 | 57 | 57 |
| panZoomed frame p95 (ms) | 17.7 | 17.7 | 17.6 | 18.2 |
| panZoomed worst frame (ms) | 17.8 | 17.8 | 116.6 | 85.2 |
| panZoomed frames >33 ms | 0 | 0 | 2 | 1 |

Zoom p5 per run, x4: before 57, 29, 31, 56, 6; after 30, 7, 29, 56. At x1 both sides read 20 in 9 of 10 runs.

Trace ranking, zoom x4, frames over 20 ms (`PERF_TRACE=1`, `scripts/perf/trace-frames.ts`, single traced run each)

| owner | before | after |
| --- | --- | --- |
| native, no JS frame (wheel dispatch, style) | 642 ms | 385 ms |
| overlay chrome build (`tileChrome`, label fit) | 109 ms | under 30 ms |
| `SentOverlay.changed` (JSON.stringify of every item) | 66 ms | gone from top 15 |
| spatial index `within` | 48 ms | gone from top 15 |
| wasm SipHash | 20 ms | gone (FxHash) |
| wasm path encoding (`PathEncoder`, hulls) | under 20 ms | 67 + 40 ms |
| createBindGroup | 18 ms | 38 ms |

Findings
- Zoom x4 p5 is unchanged at about 30. Goal (50) not met. The spread per run (6 to 57 on the same build) is larger than any effect measured, so this machine cannot resolve it under the current load.
- The overlay was rebuilt and re-serialised on every zoom step: GpuFlow passed a fresh theme object each time, which voided the zoom-free memo. Fixed; the JS overlay cost left the top of the trace.
- What now leads is wasm path encoding and vello's own bind groups per render, outside the overlay.
- No blank nodes x4 and long tasks x4 read worse after, within the same noise (before x4 no-blank ranged 3.3-4.6 s in earlier runs).
- Pixels: the settled zoomed views differ by more than 24/255 in 0.06% (x1) and 0.13% (x4) of pixels.
