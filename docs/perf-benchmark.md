# Canvas zoom benchmark

Every PR touching the canvas renderer runs `.github/workflows/perf.yml`: it builds the app in local
mode (`npm run build:node`, no Supabase), opens a synthetic heavy canvas and zooms it in headed
Chromium (xvfb) with the CPU throttled 4x through CDP.

- Fixture: `scripts/perf/zoom-fixture.mjs` — 60 motion frames (the docs in
  `tests/e2e/fixtures/gpu-docs/`) and 120 text cards, deterministic ids, written to a `.feega`
  file served by `scripts/local.mjs`. No production data, no network.
- Spec: `tests/perf/canvas-zoom-bench.spec.ts` — N runs (`BENCH_RUNS`, default 5), each a fresh
  context from a pinned camera. Per run: zoom fps, p95 and worst frame gap, main-thread CPU ms
  (CDP `TaskDuration`), time-to-sharp after a zoom burst. The median of the runs is compared.
- Baseline: `tests/perf/zoom-baseline.json`; tolerances: `tests/perf/zoom-tolerance.json`.
  `scripts/perf/zoom-compare.mjs` writes the table to the job summary and exits 1 beyond tolerance.

Runs on PRs that touch `src/lib/canvas`, `src/lib/components/canvas`, `packages/gpu-core`,
`packages/gpu-text`, the shipped wasm, or on the `perf` label.

## Run locally

```bash
npm run build:node                       # once, or after a change
npx playwright test -c tests/perf/playwright.config.ts
node scripts/perf/zoom-compare.mjs perf-results/zoom-bench.json
```

`BENCH_CASE=first-zoom` starts from fit view on a fresh page and zooms in across the 0.75 asset tier, with asset requests delayed 120–420 ms.

Headed only: headless Chromium does not run the WebGPU frames. `BENCH_TRACE_OVER_MS=500` saves a
Chrome trace (timeline, GPU, GC) of any run whose worst frame exceeds 500 ms into `perf-results/`.

## Refresh the baseline

Only on purpose (a deliberate speed-up, or a CI runner change). Take the numbers from CI, not your
laptop: download the `zoom-bench` artifact of a green run on the PR and

```bash
node scripts/perf/zoom-compare.mjs <artifact>/zoom-bench.json --refresh
```

Commit the new baseline in the same PR, saying why.

## Tolerances

Picked from measured run-to-run noise of the median (see the PR that added this): each tolerance is
about twice the largest median spread observed between repeated CI jobs, so noise alone does not
fail a PR while a real regression of that size does. `worst` is the noisiest metric (one frame);
it carries the widest band.

## Cheap guards

`src/lib/canvas/core/card-source.counts.test.ts` counts expensive calls across a zoom sweep (card
bodies built, bodies shifted per label octave). They never flake and fail on the exact cache that
broke.

## Status on GitHub-hosted runners

Hosted `ubuntu-latest` has no GPU. With SwiftShader WebGPU the adapter is granted in only some runs
and zoom runs at 1-2 fps with 3-15 s frames: the numbers measure software rasterization, not the
app. The job is `continue-on-error` until it runs on a machine with a GPU (a self-hosted macOS
runner); locally the benchmark is stable (spread below).

## Landings case

`BENCH_CASE=landings` runs `tests/perf/canvas-landings-bench.spec.ts` on six real landing pages
(stripe.com, vercel.com, supabase.com, linear.app, notion.com, figma.com) imported through the
app's URL import, each with its tablet and phone views. Per run it measures pan, zoom, fit-to-all
(Shift+1 / Shift+0) and dragging a frame, plus time-to-sharp, and writes a CPU-profile hotspot
table of the first run per gesture.

```bash
BENCH_CASE=landings BENCH_CPU=1 npx playwright test -c tests/perf/playwright.config.ts
BENCH_CASE=landings BENCH_ENGINE=webkit npx playwright test -c tests/perf/playwright.config.ts
```

`BENCH_GESTURES=drag-element` (comma list) runs only those gestures; `BENCH_PROFILE=0` skips the CPU profile, which otherwise covers the gesture window only and is saved as `landings-<gesture>.cpuprofile`.

The fixture is not committed (third-party page content, ~19 MB). It lives at
`~/Documents/feega-videos/perf/landings/landings.feega` (`BENCH_FIXTURE` overrides the path); when
missing, `scripts/perf/landings-fixture.mjs` regenerates it by importing the pages into an empty
local-mode canvas. The import calls no AI model; it needs the network, so pages change over time:
compare runs on the same file. WebKit has no CDP: no CPU throttle, no CPU ms, no profile.

## Heavy canvas case

`BENCH_CASE=heavy` runs the same gestures as `landings` on a synthetic heavy canvas: 40 frames
(12 landing pages 1280 wide and 5000–9000 tall, six with tablet/phone views; 14 posts 1080×1080;
9 slides 1920×1080; the 5 `gpu-docs` motion docs) carrying ~2,000 elements with blur, drop
shadows, background blur, masks, clipped cards, gradients, opacity, rotated groups, ~1,100 texts
and 36 generated JPEGs. `scripts/perf/heavy-fixture.mjs` writes it to the temp dir (~3.5 MB),
seeded and with fixed ids: no production data, no network.

```bash
PUBLIC_FEEGA_LOCAL=1 npm run build:node
BENCH_CASE=heavy BENCH_PORT=5488 BENCH_RUNS=1 BENCH_CPU=1 npx playwright test -c tests/perf/playwright.config.ts
```

Outputs are prefixed `heavy-` (`heavy-chromium-start|fit|zoomed.png`, `heavy-bench-chromium-1x.json`).
