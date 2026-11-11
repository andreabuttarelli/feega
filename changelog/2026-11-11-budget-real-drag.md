# Perf bench: the frame-budget drag grabs a real frame

`tests/perf/canvas-frame-budget.spec.ts` dragged from a point 10 px above the frame at fit,
after a `click` that turned the press into a double-click. On the heavy canvas, fit makes frames
~18 px wide and their label hidden, so nothing was grabbed: the 0.8% "pass" was a canvas at rest.

Now the drag picks the largest tile whose label is on screen, zooms on its label until the frame is
≥ 300 px wide (setup, not timed), presses the label and fails the run if the frame's `data-box`
did not change. Each gesture also reports `taskMs`, main-thread task time from CDP
`Performance.getMetrics`, so CPU cost per gesture is visible next to the frame gaps.

First honest numbers (1 run, load avg 14–18): landings drag 9 pointer moves in 4 s, p95 220 ms;
heavy drag p95 17 ms, 8% over budget.
