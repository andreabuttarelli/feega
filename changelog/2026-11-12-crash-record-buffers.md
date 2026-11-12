# The canvas crash record counts GPU buffers

Signal: the first real phone death recorded (2026-11-12 18:06Z, iPhone,
`webcontent-crash-suspected`) reported 160 MB of textures and 59 MB of wasm
during a pure pan at zoom 0.05 — too little to kill a tab. The same state
(440×748 CSS, DPR 3, resolution 2, landings fixture, WebGPU in Chrome)
holds ~224 MB of live GPU buffers the record never counted: vello's fixed
bump buffers alone are 176 MB (`lines` 48, `segments` 48, `tile` 32,
`ptcl` 32, `seg_counts` 16).

Change: `probeGpu` counts `createBuffer`/`destroy` like textures; the crash
record, the `?coreDebug` HUD line and the perf beacon's `memory.bufferMb`
carry it. No behaviour changes.
