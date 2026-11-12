# Canvas perf telemetry from real users

`perf:budget` measures two canvases on one machine. We had no numbers for the canvases and
devices users actually have.

Each canvas session now aggregates load marks, per-gesture frame gaps, long tasks, edit latency,
GPU backend and fallbacks, device class and canvas size in the browser, and sends one cumulative
summary every 5 min and on page hide to `/api/v1/telemetry/canvas-perf`, which writes a
`canvas_perf` row in `product_events`. Percentiles come from fixed-bucket histograms: O(1) per
frame, nothing allocated.

Decisions:
- One cumulative summary per session id instead of per-gesture events: one row per 5 min, the
  report keeps the latest.
- Sampling is a constant (100% today), not a flag.
- `product_events.event` has a CHECK list: migration `20261112100000_canvas_perf_event.sql`
  extends it; until applied, `track()` logs and drops the row.
- Internal accounts are excluded at read time (`scripts/canvas-perf-report.mjs`), not at write
  time, so our own sessions stay inspectable.

Discarded: PostHog for this (sampling and retention outside our control, and the SQL report
joins on our users).
