# Timed comments on the frame timeline

A comment on a motion frame can carry a moment (`time_ms`, stored by the server since #1223).

- `comment-marks.ts`: pure conversion ms <-> frame and `marksFor` (open threads of this frame with
  a time). Resolved threads leave the timeline like they leave the canvas.
- `FrameTimeline` draws a numbered marker per mark; click seeks (`scrub`) and focuses the thread.
  "Comment here" drops a pending placement with `timeMs = playhead` through `GpuFlow`
  (`onPinAtPlayhead`) into `commentsPanel.drop`; `addThread` sends `time_ms`.
- Markers sit on a strip scaled to the whole duration, not on the zoomed ruler: simpler, and a
  marker never leaves the strip when the ruler zooms.
