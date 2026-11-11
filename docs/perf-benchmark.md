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

## Load case

`BENCH_CASE=load` runs `tests/perf/canvas-load-bench.spec.ts` on the landings fixture: time from
navigation to the first non-white pixels of each on-screen frame, to all of them, and to a still
screen (all sharp). A frame counts as content only when at least 0.5% of its pixels are neither
white nor the canvas paper. Each run starts a fresh server on a fresh copy of the fixture (its hash
is checked after the run); `cold` is a new browser context, `warm` opens the canvas once and
measures the second open in the same context. The first run per build and cache case carries a
CPU-profile hotspot table.

```bash
BENCH_CASE=load BENCH_BUILDS=base=../dazero-base,fix=. npx playwright test -c tests/perf/playwright.config.ts
```

`BENCH_BUILDS` interleaves builds (each root needs `npm run build:node`); without it the spec
measures this checkout. An entry may carry its own query (`off=.?coreTiles=0,on=.?coreTiles=1`) to
compare one build with a switch off and on. The spec fails when a frame is still blank in a
screenshot taken more than a frame after its vectors were drawn (`shownLate`). `BENCH_RECORD=1` saves a video per case.

The spec runs headless, where WebGL is SwiftShader (CPU). Startup there carries a 0.9–2.3 s long
task of shader compiles and draws that headed Chrome on a real GPU does not have; a startup cost
seen only here is the harness, not the product.

`FEEGA_LOCAL_LATENCY_MS=<ms>` delays every local database query by that much, so the bench sees
round trips like a remote Supabase (the user's canvas costs ~1.1–1.7 s per sources batch there,
local answers in ~70 ms). Give both builds the same value.

Resource Timing's `responseEnd` waits for the page's main thread: a long task during start makes
a 5 ms body look like a 1 s download. Check `longtask` entries before reading it as network time.

## Debug log

Off by default. Add `?debug` to the canvas URL, or run `localStorage.setItem('feega:debug', '1')`
and reload, to print every load and render step to the browser console with the `[feega]` prefix,
a time from navigation start and an area tag: `[startup]` `[sources]` `[build]` `[upload]`
`[raster]` `[images]` `[posters]` `[camera]` `[tiles]`. Sources lines carry bytes, ms and Server-Timing
phases; `[camera]` lines mark gesture start/end and any frame over 32 ms with the gesture name.
Lines are buffered for 100 ms and printed in time order. Each frame gets a collapsed group with
the asked, source, built, put and drawn durations once it is drawn. `[images]` logs asset tier
switches; `[tiles]` logs gesture and rest render starts, raster passes per frame (from the render
tally), cache evictions and settle. Nothing is subscribed or built when off.
