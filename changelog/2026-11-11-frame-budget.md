# Perf: a 90 fps frame-budget check, run locally before merge

`npm run perf:budget` pans, zooms, toggles fit and drags on the landings fixture and on the copy
of the heavy canvas (test account), in headed Chromium with vsync and the frame cap off, so a
frame gap is the frame's real cost. It fails a gesture at p95 > 11.1 ms or > 2% of frames over.
Not in CI: hosted runners have no GPU (see the zoom bench). Docs in `docs/perf-benchmark.md`.

Today it fails: the baseline is in the PR. Kept failing on purpose — the number is the target.
