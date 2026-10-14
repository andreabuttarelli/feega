# Text, rectangle, ellipse and pen tools inside a frame

A frame (still or video) gets a draw toolbar at the top left of its stage: Select (V), Text
(⇧T), Rectangle (⇧R), Ellipse (⇧O), Pen (⇧P). The plain T/R/O/P stay the timeline's reveal keys;
the tools sit on shift until a Design mode can own the plain keys.

- **Drag to create** (`DrawOverlay.svelte` → `drawClip` in `draw-create.ts`): text is a `Text`
  clip, rectangle and ellipse are `Shape` clips on the drawn box; shift locks the ratio. In a
  video the clip starts at the playhead and is clipped to the end; in a still it spans the whole
  frame. A click without a drag with Text drops a default box. The new clip is selected and the
  tool goes back to Select.
- **Pen**: click adds a corner, click-drag pulls bezier handles (alt breaks the mirror), a click
  on the first point closes, Enter or Esc finishes an open path. `penClip` boxes the clip on the
  points and stores the path in the box's own 0..1 units, the same format `add_shape`/`set_path`
  take. Point editing after creation is the existing `PenOverlay` (move points and handles, alt
  deletes, its Pen toggle adds points).
- **Text in place**: double-click a selected text clip edits it on the canvas, reusing the
  poster-part editor (`CLIP_TEXT` in `poster-parts.ts`).

Move, scale, rotate and multi-select are the existing selection overlay. The geometry
(`dragRect`, `resizeFromCorner`, `nudge`, `roundnessFromInset`, `closesOnFirst`) is pure and
tested in `draw-tool.ts`.

AI parity: no new tool. The chat agent and MCP `motion_tool` already create the same clips with
`add_clip` (Text), `add_shape` (rect, ellipse, path with `d`) and `set_props`.

Not done: per-corner radius (`rectOutline` takes one roundness; four radii is a schema change),
an on-canvas radius handle, adding a point on a segment, arrow-key nudging (arrows step frames
today; it belongs to Design mode). The e2e `canvas-draw-tools.spec.ts` runs green against the real
stack; the toolbar sits bottom-left so it never covers the pen overlay's own buttons.
