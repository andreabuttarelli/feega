# Frame styling in the right bar

- Before: with nothing selected, Design mode listed only document settings; the frame had
  `background: brand | transparent` and nothing else.
- Now `MotionDoc.surface` names a locked full-frame `Shape` clip on a bottom track
  (`motion/surface.ts`: `withSurface`, `dropSurface`, `frameSurface`). Fills, strokes,
  corners, opacity, blend and effects are that clip's props, so the GPU display list, the
  hyperframes HTML and codegen draw it with no new renderer code; codegen already maps a
  full-frame root shape onto `<main>` (bg, border, rounded).
- `FrameInspectorPanel` renders `MotionInspector` with `as={PropertiesView.Frame}` on
  `withSurface(doc)`: the surface is only written on the first edit. `sectionsFor` keeps
  Layer, Fill, Stroke, Shape, Effects for that view. Doc settings fold under `Frame settings`.
- Agents: `set_canvas` `surface: true|false`; `get_motion_doc` returns `surface`.
- Discarded: a separate `frameStyle` object (would need three renderers and codegen changed).
- Not done: clip-content toggle, auto layout on the frame, numeric W/H fields.
