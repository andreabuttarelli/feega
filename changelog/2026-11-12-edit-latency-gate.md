# Canvas: edit latency gate in perf:budget

`perf:budget` measured frame gaps, not how long an edit takes to reach the screen. The landings
bench's `editMs` (~150–170 ms) polled full-viewport screenshots, so its floor was the screenshot
itself and it only dragged whole frames.

The budget run now edits one element inside a frame (nudge, resize, opacity, hide, text) and times
input `timeStamp` → `frame|drawn` of the rebuilt live layer, split by new `live-asked`,
`live-built`, `live-ready` marks in `CoreFrames.rebuildLive`. Gate: p95 ≤ 16.7 ms per edit kind;
`atGoal` records the 8.3 ms (120 Hz) target. It fails today: first landings run gave p50
176–329 ms, dominated by main-thread work before the rebuild (70–125 ms) and the whole-frame worker
build (155–200 ms).
