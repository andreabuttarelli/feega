# Scorecard: Chrome input→paint from the trace

Every Chromium input→paint p95 was a multiple of 8 (40/48/56). Cause: Event Timing rounds
`duration` to 8 ms by spec. Checked against a Chrome trace on the heavy canvas: clicks present in
37–53 ms (EventLatency), Event Timing said 40/48/56 — rounded, not floored; 56 ms was real. The
in-page rAF+setTimeout measure, mixed into the same p95, under-reported (≈16 ms: rAF callback,
not frame presented).

On Chromium the probe now traces `EventLatency` per step (OS input timestamp → frame presented,
µs). WebKit keeps the in-page measure (no trace there). Re-baseline, gpu/session: editor steps
45–64 ms, open frame 146 ms, pan/zoom 62 ms; frame p95 18 ms. Latency ≈ 3 frames while frames
are on budget: the cost is in the pipeline depth, not in main-thread work.
