# Two CI flakes: a CDP error and a wall-clock budget

Both merged on red more than once. Values from `gh run view --log` of the last 60 failed and
30 green CI runs.

- **`cursor-smoothness` "ui-morph in 1:1" was not timing.** All three failures (runs
  38903439727, 39053077395, 39120053675) died in 70–90 ms on the warm-up capture with
  `Page.captureScreenshot: Unable to capture screenshot`: the compositor had no frame yet.
  Captures now go through `capturePainted` (`src/lib/motion/shots/capture.ts`): on that one
  error it waits two rAFs and retries, at most 5 times; any other error still fails. The
  jolt assertion is untouched. Not reproducible on macOS (240 parallel captures, 0 errors).
- **`shader-fx` 1080p grain budget measured the runner, not the shader.** Green runs ranged
  27–61 ms/frame for the same code; failures were 60.6–62.5 ms against a 60 ms bound. The test
  now times grain against a passthrough 1080p draw in the same page, interleaved, median of 9
  rounds of 5 draws, and bounds the ratio at 3×. Local data (20 runs parallel, 30 runs under 8
  CPU hogs): ratio 0.83–1.66. A 24-fetch noise shader measures 5.4–6.4×, so a real regression
  still fails. Discarded: raising the ms bound (hides regressions on fast runners, still flakes
  on slow ones).
