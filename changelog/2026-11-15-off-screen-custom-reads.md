# Custom component reads wait until the frame is on screen

On desktop `CoreFrames` builds every frame of the canvas, off-screen ones too. A frame with
`Custom`/`Device3D`/`Composition` clips mounts a srcdoc iframe to read its DOM, and each creates
a GPU context. Opening the heavy canvas copy in headless Chromium stalled the page twice: 8.8 s
and 23.7 s.

Now `readSight` (`src/lib/canvas/core/read-sight.ts`) holds those builds: an off-screen frame that
needs a DOM read throws `OffScreenRead`, its slot is freed, and `withinBudget` skips it until it
enters the view. Frames without custom reads still build everywhere.

The 23.7 s stall is gone. The remaining 8 s one is headless-only: the main thread waits in
`CreateViewCommandBuffer` while the software GPU process runs a 14 s WebGPU command buffer.
Headed, on the real GPU, neither canvas stalls before or after.

Probe: `tests/perf/canvas-frame-budget-freeze.spec.ts` (`BENCH_CASE=budget`; `PROBE_HEADLESS=1`
for headless).
