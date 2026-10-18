# A one-frame work area no longer traps playback

Report: on the interactive Saturn frame, Space jumped the playhead to the
start and it never got past frame 1. The cause was not playback code: the
doc was saved with `workArea: { from: 0, to: 1 }`, probably from an out
point set at frame 0 (`workEdge` sets `to = frame + 1`). `loopFrame`
looped play inside that one frame, exactly as written. No commit since
#680 regressed anything.

- `organize.ts`: a work area shorter than `MIN_WORK_AREA_S` (0.5 s) is
  refused by `setWorkArea`. `loopFrame` ignores a saved one, so docs that
  already have one play again. The rule sits in `watchable`, the only place
  that decides it.
- canvas-inline-play now plays four docs: the plain video, stack-words,
  scroll-story and the video with a one-frame work area. The last one
  failed before the fix and passes after it. The real Saturn doc was not
  used: 220k points in software GL make Playwright screenshots time out.
- The spec is in `test:gate` and the `webkit-perf` project.

Discarded: clamping the work area in the timeline UI only, which would
leave agent tools and docs already saved broken.
