# Vector networks

A Shape can now be `vector`: `props.network` holds vertices, segments (cubic, tangents relative
to their vertex) and regions (loops of segments that fill), in 0..1 of the box. Unlike a path,
any number of segments can meet at a vertex, so a point can branch.

- Math ported from an MIT editor (see `THIRD_PARTY_NOTICES.md`), adapted and without comments:
  curve math, split/remove/delete/break, handle mirroring, region reindexing, stroke runs.
- Rendering stays in the HTML engine (so both canvases and every export see it): strokes draw the
  stroke runs, fills draw only the regions (`FILL_OUTLINE`).
- Paths and shapes keep their own data; "Edit as vector" (`toVector`) converts any shape
  losslessly (cubics map one to one, closed contours become one region).
- `VectorOverlay`: drag points and handles (mirrored on smooth points), click a segment to add a
  point, Pen to draw from the selected point or join two points, Fill, Break, Delete (⌥ cuts).
- Agents: `to_vector`, `set_vector_network`. Real-stack e2e: drag + branch.
- Not yet: pencil/freehand, region editing by click (Fill fills every closed run).
