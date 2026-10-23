# Frames rest at time 0 on the canvas

`stillFrame` (#1099) rested every frame at 40% of its duration or of its content end. A clip
that ends before that instant was invisible: a Figma paste (#1190) showed only the black
background.

- One constant, `REST_SECOND = 0` in `src/lib/motion/poster-time.ts`. `stillFrame`
  (`core/frame-source.ts`) and `posterSecond` (compose-page poster) both read it, so the core
  frames, placeholders, pick/hit-test, selection overlays, text autosize/caret and the
  inspector default playhead all rest at 0. A doc with its own `still` keeps it.
- `videoPoster` (poster of a generated video file) keeps its own 40%: it is a media file, not a
  frame.
- New clips drawn in a video frame (`SPAN` in `draw-create.ts`, so also Figma and SVG paste and
  the draw tools) run from the start frame to the end of the frame, not the component default.
  An inserted picture does too (`Element.fillsFrame`). Videos and audio keep their own length.
- Gallery seed scripts keep 40%: they are not the canvas.
