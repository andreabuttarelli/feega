# iOS fast gesture crash

On iPhone Safari a fast pan or zoom reloaded the tab; slow movement was fine. No error: WebKit kills WebContent over its memory limit.

Cause: no backpressure between `FramePacer` and the GPU. Each rAF painted a new frame (one frame is up to ~540 `queue.submit`s, one per layer) whether or not the GPU had finished the last one. Textures `destroy()`ed meanwhile stay allocated until the GPU is done with them, so during a burst they piled up.

Fix: `WebCore` counts frames whose work is not done (`on_submitted_work_done`); `busy()` is true at `FRAMES_IN_FLIGHT` = 1. `FramePacer` takes a `busy` predicate: a busy rAF skips the paint and asks for the next one. Sharpening during zoom is unchanged; it only waits for the GPU. WebGL and native cores have no `busy` and behave as before.

Measured with `scripts/perf/fast-burst.ts` (Chrome WebGPU, 390x844 DPR 3, heavy canvas copy, 12 bursts of 60 large wheel pan / ctrl-zoom steps). Texture bytes count until the GPU finishes the work after `destroy()`.

| | before (5 runs) | after (4 runs) |
| --- | --- | --- |
| peak texture MB | 648–1017, median 892 | 533–606 |
| peak submits in flight | 1042–2613 | 538 |
| wasm memory MB | ~34 | ~35 |

Discarded: frames in flight = 2 (peak 684 MB). Debounced re-raster: the zoom cache already rasters one group per frame (`RASTERS_PER_DRAW`); the pile-up was frames, not rasters.

Not verified on a real iPhone: Playwright WebKit has no WebGPU, and Safari's limit and texture release timing differ from Chrome.
