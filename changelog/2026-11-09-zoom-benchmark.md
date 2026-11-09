# Zoom benchmark in CI

Perf work on canvas zoom was measured by hand on a copy of a production canvas
(`tests/e2e/canvas-zoom-profile-probe.spec.ts`), so nothing stopped a PR from being slower.

Now `.github/workflows/perf.yml` runs `tests/perf/canvas-zoom-bench.spec.ts` on every PR touching
the canvas renderer: local-mode build, synthetic `.feega` fixture (frames, text cards, images; no
Supabase), headed Chromium under xvfb, CPU 4x. Median of 5 runs vs `tests/perf/zoom-baseline.json`,
per-metric tolerances in `tests/perf/zoom-tolerance.json`, table in the job summary.

Count guards in `card-source.counts.test.ts` pin the card caches from #1843/#1844.

Discarded: a vite-dev server (slower, noisier, HMR), headless (no WebGPU frames), committing the
`.feega` binary (generator is deterministic and 30 MB smaller).

How to run and refresh: `docs/perf-benchmark.md`.
