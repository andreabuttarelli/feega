# Frame tool inside a frame draws a nested frame

ST-01 of the parity roadmap. A frame container already nested (a rect Shape clip with children
parented to it, own fill, stroke, radius and `clipContent`), but nothing in the UI drew one.

- `drawClip` with `DrawTool.Frame`: a white rect Shape with `clipContent: true`.
- `GpuFlow`: the canvas-level draw layer shows for the Frame tool only outside an open frame;
  inside, the in-frame draw overlay takes the drag. Before, the Frame tool always made a new
  canvas frame, even while editing one. Esc leaves the frame to draw a top-level one.
- Not done: dropping a frame tile onto another frame to nest it.
