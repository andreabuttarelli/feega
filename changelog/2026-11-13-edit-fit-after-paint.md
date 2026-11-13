# Text fit waits for the edit's frame

A patched edit on landings reached the screen at p50 ≈ 60 ms. A profile from key to patched frame
showed the pacer skipping the first frame after the key because the GPU was still on the previous
one (`busy()`), and the zero-timeout text fit (`autosize` → `fitTextBoxes`, about 25 ms of
`measuredTexts`) running before the next frame.

- `FramePacer.afterPaint(job)`: work released on a timeout after the next frame that actually drew;
  busy frames keep it waiting. `CoreFrames` exposes it; `GpuFlow.autosize` uses it.
- Kept: the GPU busy skip itself (`FRAMES_IN_FLIGHT = 1` in `packages/gpu-core`). With the main
  thread free after the key, a skip costs 1–3 ms instead of the next 25 ms.

Measured on landings (M2 Pro, 60 Hz display, uncapped, not 120 Hz), patched edits p50: opacity
61 → 41 ms, nudge 60 → 40 ms, hide 59 → 42 ms.
