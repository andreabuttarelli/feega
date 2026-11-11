# Phone canvas profile in one table

Report: the user's heavy canvas crashes mobile tabs while frames load.

`BUDGET` in `memory-budget.ts` now holds every per-device knob of the core
canvas: textures, tiles, picture side, DPR cap, frames in flight, retain time
and frame-build worker lanes. `IN_FLIGHT`, `RETAIN_MS` and `BUILD_LANES_MAX`
left `CoreFrames.svelte`. Desktop values are unchanged and pinned by a test.

Change: a phone builds frames on one worker instead of up to
`hardwareConcurrency - 1` (3 on a 4-core iPhone), each with its own wasm and
copy of the frame doc.

Measured (heavy copy, test account, Chromium 390x844 DPR 3): textures peak
228 MB / JS heap 257 MB, 1 worker spawned, 58-60 fps; no crash. WebKit iPhone
on prod: WebContent ~680 MB, GPU process ~180 MB, stable, but the WebGPU
device is lost once right after attach and the core reattaches. Neither
emulation reproduces the crash; tile and texture memory were already capped
on phones (128 + 128 MB). Baked tile levels stay: they draw from the capped
tile budget.

`scripts/perf/mobile-memory.ts` now counts workers and samples during load.
