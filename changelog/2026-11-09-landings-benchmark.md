# Landings benchmark

A user reported the canvas below 60 fps on canvases of imported landing pages. The zoom benchmark
only had synthetic motion frames, so nothing measured that.

`BENCH_CASE=landings` adds a second case: six real pages (stripe, vercel, supabase, linear, notion,
figma) imported via URL import with tablet and phone views, measured on pan, zoom, fit-to-all and
frame drag, Chromium (CPU 1x/4x) and WebKit, with a CPU-profile hotspot table per gesture.

The `.feega` fixture is not committed (third-party content, 19 MB); `scripts/perf/landings-fixture.mjs`
regenerates it through local mode, no AI calls. Not in CI: it needs the network and the GitHub
runners have no GPU. How to run: `docs/perf-benchmark.md`.
