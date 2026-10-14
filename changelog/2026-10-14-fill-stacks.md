# Fill stacks on shapes and poster photos

**Before.** A Shape had one fill (`fillKind` solid/linear/radial/none, `fill`, `fill2`,
`gradientAngle`). A poster photo slot was `{assetId, fit, focusX, focusY}` with its own panel.

**Now.**
- `motion/fill/model.ts`: `fillsSchema`, an ordered list (first = bottom) of layers
  `solid | linear-gradient | radial-gradient | image`, each with `opacity`, `visible`, `blend`.
  `fillsOf` reads `props.fills` or turns the legacy fields into one layer; `photoFills` does the
  same for a media item. No DB migration: old docs read as one layer, and are written as a stack
  only when edited. Pure ops (`addFill`, `moveFill`, `setFill`, `retypeFill`, stops) feed the UI.
- `motion/fill/render.ts`: `svgFills` draws one `<g>` per visible layer under the stroke
  (gradients as `<defs>`, images as a `<foreignObject>` clipped to the outline, so `inlineMedia`
  inlines them on export like any `<img>`). `fillLayersHtml` is self-contained so the poster view
  inlines it with `toString()`; one absolutely placed div per layer, image as `<img>` (exact
  focus/scale via `object-position`/`transform`), tile as a repeated background, radial sized in
  container units so it matches the SVG circle.
- Shape schema gains optional `fills` (`Control.Fills`); the four legacy keys are hidden in
  Properties but still parsed. The stroke gradient still reads `fill`/`fill2`.
- `resolveMedia` adds resolved `fills` to every media slot; the type grid view renders them.
  Docs that embed the old view source keep rendering their photos the old way until the poster
  is reinserted.
- `FillStack.svelte`: self-contained Fill section (rows top-first, drag to reorder, eye, opacity,
  type, + / −; gradient bar with draggable stops, angle or centre/radius; image picker, fit,
  focus, scale; blend). Used by `MotionInspector` for Shape and by `PosterPartPanel` for photos.
- Agent: `add_shape` takes `fills`; `set_props` describes fills for shapes and poster slots.

**Not run.** `tests/e2e/canvas-fills.spec.ts` and the updated poster-parts spec are `@real`;
seeded runs against production were stopped on 14/10, so they are unexecuted.

**Discarded.** SVG `<pattern><image>` for picture fills: no arbitrary focus without the image
size, and `inlineMedia` does not inline SVG images.
