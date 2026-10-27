# Core renderer, mobile memory, 2026-10-27

`scripts/perf/mobile-memory.ts`: Chrome (WebGPU), 390x844, DPR 3, touch, heavy canvas copy (project f0052fa8, canvas a729ae34) as the test account, dev server. 20 s settle, then 5 min of wheel pan legs (drifting, reversing) with ctrl-zoom bursts, samples every 2 s. Textures = created minus `destroy()`ed (memory held until GC); steady = mean of the last 5 samples.

| metric | before peak | before steady | after peak | after steady |
| --- | --- | --- | --- | --- |
| GPU textures not destroyed | 13659 | 13376 | 182 | 156 |
| GPU texture MB not destroyed | 25121 | 24651 | 141 | 138 |
| ImageBitmaps | 56 | 56 | 24 | 13 |
| ImageBitmap MB | 176 | 176 | 29 | 26 |
| wasm linear memory MB | 21.9 | 21.9 | 21.9 | 21.0 |
| JS heap MB | 215 | 176 | 197 | 168 |
| video elements | 0 | 0 | 0 | 0 |

| fps (6 s pan) | before start | before end | after start | after end |
| --- | --- | --- | --- | --- |
| avg | 60 | 60 | 60 | 60 |
| p5 | 55 | 54 | 55 | 55 |
| frames >33 ms | 0 | 0 | 0 | 0 |

Findings
- wasm memory is flat (~22 MB): not the cause.
- Texture growth was linear, ~50 textures/s while panning: per-tile scratch textures and pooled textures dropped without `destroy()`. Chrome's GC hides it on desktop; Safari's does not.
- Not measured: a canvas with video (none found in the test account), real WebKit (Playwright WebKit has no WebGPU), Safari's GC timing and jetsam limit.
