# The canvas perf beacon can see a phone that dies

Signal: production `canvas_perf` (live since 2026-11-12 11:19 UTC) had 97
rows, all `desktop`, none with a device loss or a fallback, and 41 with
`backend` and every timing null, arriving every ~300 s. Users report the
tab dying on iPhone and iPad on the first pan or zoom.

Why the old beacon could not see it: it was sent only on a 5-minute timer,
on `visibilitychange` hidden and on `pagehide`. iOS kills an over-budget
tab without any of those events, so a session that dies in its first
minutes leaves no row. `device` is `phone` for any touch device (iPad
Safari reports `maxTouchPoints` 5 with a Mac user agent), so "zero
phones" means zero phone sessions reached a beacon, not iPads counted as
desktops. A null `backend` means the engine never attached in that page:
`perf.backend` is called only once a raster exists.

What a beacon now carries:

- `reason`: `start` (sent as soon as the engine is up, with the WebGPU
  adapter's `maxTextureDimension2D`/`maxBufferSize`), `heartbeat`,
  `hidden`, `pagehide`, `stop`.
- `platform`: `iphone`, `ipad` (also behind the Mac user agent), `android`,
  `desktop`.
- `visible`, `width`, `height`: a null-backend row with `visible` 0 and a
  0×0 area is a tab never drawn (background tab), not a broken engine.
- `memory`: GPU texture MB and count, wasm MB, zoom cache MB, picture MB.
- `lastError`: last attach failure, device loss or uncaught error (≤200
  chars).
- `diedBefore` and `before`: the previous canvas session in this browser
  ended without `pagehide`/hidden, and what it held at its last 250 ms
  sample (from the crash record already kept in `localStorage`). This is
  how a jetsam kill shows up: on the next load.

The view `canvas_perf_sessions` gains these columns
(`20261112200000_canvas_perf_health.sql`, apply by hand). Old clients
still post v1 summaries; the server keeps only the fields it knows.

Not done: the Sentry crash report still fires only for a death inside a
gesture (`wasInGesture`); the beacon's `before` now covers deaths at rest.
