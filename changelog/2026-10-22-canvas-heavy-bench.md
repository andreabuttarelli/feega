# Heavy canvas bench (`npm run bench:canvas`)

Local script, not CI: it needs the real stack (`E2E_REAL_STACK=1`, test@dazero.co credentials).

- `tests/e2e/canvas-heavy-bench.spec.ts` seeds a disposable project with 200 frames, one a 1440x4734 landing page, then measures first paint, pan and zoom frame times and frame-select latency at 1x and 4x CPU throttle.
- Writes `~/Documents/feega-videos/perf/canvas-bench-<date>.md`.
- Not kept in CI: it reads and writes the database, and software WebGL in headless Chromium gives meaningless frame times (1 fps), so it runs headed.
- Not measured: selecting an element inside a frame.
