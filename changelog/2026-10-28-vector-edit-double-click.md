# Double-click a shape to edit its points

Point editing (`PenOverlay` for paths, `VectorOverlay` for networks) existed but was reachable only with Enter, and only for paths, vectors, polygons, stars and lines.

- Double-click on the selected shape enters it (`FrameTools`; `landsOn` checks the click is on the shape).
- Rect, circle and ellipse now convert to a path on entering, like polygons.
- Double-click on a point toggles sharp/smooth (Alt-click kept). Enter now also exits.
- Vector networks: smoothing a point sets `mirroring` to angle-and-length, so dragging a handle mirrors the other; Alt-drag breaks it (`setTangent(..., Mirror.Broken)`). Before, smoothed network points never mirrored.
- Agent parity: `edit_path_points` `handle` op takes `mirror` (default `broken`, unchanged); description lists every shape kind.

Discarded: editing primitives without converting them — the path model already covers every op, and morph/boolean code reads paths.
