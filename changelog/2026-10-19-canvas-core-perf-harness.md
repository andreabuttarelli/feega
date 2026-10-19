# Canvas core perf harness, indexed culling

- `tests/e2e/canvas-core-perf.spec.ts`: opens the heavy canvas copy (project e472ff3c…, canvas b5a892f3…) under each renderer in `CORE_PERF_RENDERERS` (default `gpu,core`), drives a middle-button pan and a ctrl-wheel zoom, and writes a markdown table to `~/Documents/feega-videos/core-perf/`: input→paint p95 (event timestamp → second rAF), frame p95 (rAF deltas), time to first full paint (goto → surface + 2 rAF), JS heap (Chromium only, `n/a` elsewhere). Runs with `E2E_REAL_STACK=1 E2E_PERF=1` on chromium, `webkit-perf` and the new `webkit-iphone-perf` project. Reduction lives in `scripts/canvas-core-perf/summary.ts` (unit tested).
- `SpatialIndex.visible(view, screen)` replaces the linear `visibleIds` scan for the preview-due query in `GpuFlow`.

Only run it with load average < 6: numbers under load are noise.
