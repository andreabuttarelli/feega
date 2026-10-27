# Four canvas findings from the demo recorder

Guarded by `tests/e2e/canvas-gpu-demo-bugs.spec.ts` (fails 3 of 4 on the old code; the
variants case passes on both, see below).

- **Combined video black for seconds.** Not the frame placeholder: the poster card of a
  frame with no poster painted the black `STAGE` (`core/cards.ts`). It now paints the stage
  only behind a poster. Also, before the parent's doc is fetched its draw key has no scene
  stamp, so the worker built it with unresolved scenes; `buildFrame` now leaves docs with
  scene references to the main thread (`MAIN_THREAD_ONLY`), which resolves them.
- **Variants empty.** Not a render bug: the instance draws every variant (raw frames and
  the spec agree). The demo camera zoomed on the Properties select, so the contact sheet
  showed the frame cut off. `d.select(target, option, watch)` keeps the watched rect in shot.
  The demo now seeds a product card whose buy button has Default/Hover/Done.
- **Adjustments invisible.** They reach the GPU (a seeded `adjust` draws). The canvas drew
  a frame edit only on a live gesture or after the save round trip, so a slider showed
  nothing until release + ~0.8 s. `FrameEditSession.recordEdit` now shows the recorded doc.
  The crop: the demo dragged the corner inward (zoom out) on a cover picture; `zoomedAt`
  clamped width and height apart and stretched it. The scale is now clamped as one value;
  the demo zooms in.
- **Text invisible at t=0.** `stillFrame` defaulted to `REST_SECOND = 0`. `restFrame`
  (display-list) samples summed clip opacity over the first 2 s, never past the end of a
  clip on screen at 0 (#1198's reason for resting at 0), and picks the first frame at 99%
  of the peak. One function serves draw, overlays and posters (`restFrameOf`, memoized per
  doc). Discarded: drawing each element at its settled state (not a real frame of the
  video, and overlays would measure a moment that never plays).
