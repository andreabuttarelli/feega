# Draw tools: polygon, star, line, arrow, ellipse arcs

Parity roadmap P3. The doc already had polygon and star shapes, but no tool drew
them; lines and arcs did not exist.

- `DrawTool.Polygon` / `Star`: box tools (triangle, 5-point star), in the
  Design bar, inside frames and free on the canvas (`drawnBox` schema).
- `DrawTool.Line` / `Arrow`: a drag from end to end becomes a stroked open
  `path` with no fill (`lineOutline`). Shift snaps to 45°. The arrow head is
  part of the same open stroke (tail → tip → wing → tip → wing); a separate
  closed filled head was tried and dropped, a chevron is Figma's default cap.
  On the canvas the pen wire now carries fill/stroke for stroked paths, the
  element keeps at least 24 canvas units of room and a 2-unit stroke.
- Shortcuts: ⇧L line on the canvas (the canvas uses ⇧+letter; bare L stays
  global). In the old editor's Design mode L line, ⇧L arrow.
- Ellipse `arcStart` (°), `arcSweep` (−1..1), `arcRatio` (hole): pie, arc and
  ring outlines in `ellipseOutline`, shown in Properties for ellipses only.
- MCP: the canvas `draw` op takes polygon/star (pen fill/stroke stay on the UI wire to keep the chat tool budget; agents stroke a path with the motion tools); motion
  tools take the arc props through the Shape schema.

Not done: arrow caps as a stroke property (start/end cap kinds), on-canvas
arc handles.
