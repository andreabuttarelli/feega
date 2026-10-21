# Timeline under the selected frame on the canvas

Selecting a core-drawn frame opens `FrameTimeline` at the bottom of the canvas: `MotionTimeline`,
`GraphEditor`, `TimeRemap`, play/pause. Edits go through the frame's `FrameEditSession` (`commit`).

- The playhead is `LiveDoc.playhead`, not `doc.still`: `still` settles text animations and is
  saved with the doc. The playhead is display-only and cleared when the frame is left.
- `frameOfLive` is the single place that picks the frame to draw: `CoreFrames`, `buildFrame` and
  `framePicker` all use it, so drawing and `pickAt` share the same time.
- `framePicker` takes a playhead getter, so scrubbing does not recompile the scene.
- Other frames keep their posters. `MotionTimeline` already took props; the shell is unchanged.
