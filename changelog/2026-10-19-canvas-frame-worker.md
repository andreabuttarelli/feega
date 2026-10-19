# Canvas frames built in a worker

The core canvas built every frame's display list (`prepare` + `drawFrame`) on the main
thread: 35-75 ms per frame on WebKit, the worst frames during pan. A worker
(`frame-build.worker.ts`) now fetches the doc, loads fonts (fontkit) and builds the still list;
the list crosses by structured clone. Docs with Custom/Device3D (DOM reader) and any worker
failure keep the main-thread path.

`posterSecond` moved to `poster-time.ts`: `frame-source` dragged `$app`/`$env` into the
worker through `poster-capture`; a test walks the worker's static imports and fails on any.

While the view moves (150 ms quiet window) no group is put into the core; puts resume when it
settles.

Bench (heavy canvas, core): iPhone pan worst 205 -> ~45-72 ms, Chrome first coverage faster.
Chrome residual pan stalls carry no script time (GPU side), and zoom re-rasters are left to
the core pan/zoom work. The bench now also measures a zoom in/out sequence.
