# Fill stacks on shapes, text and poster photos

**Before.** A Shape had one fill (`fillKind` solid/linear/radial/none, `fill`, `fill2`,
`gradientAngle`); text had one `color`. A poster photo slot was `{assetId, fit, focusX, focusY}`
with its own panel.

**Now.**
- `motion/fill/model.ts`: `fillsSchema`, an ordered list (first = bottom) of layers
  `solid | linear-gradient | radial-gradient | image`, each with `opacity`, `visible`, `blend`.
  Colours carry alpha as `#rrggbbaa` (`colourAlpha`/`withAlpha`), apart from the layer opacity.
  Old docs read as one layer and are written as a stack only when edited: no DB migration.
  Pure ops (`addFill`, `moveFill`, `setFill`, `retypeFill`, stops) feed the UI.
- `motion/fill/elements.ts`: one table, component → which single-colour fields the stack replaces
  and how the old value reads as a layer (Shape, Title, Text, Kicker, Caption). Properties hides
  those fields for every filled component.
- `motion/fill/render.ts`:
  - `svgFills` draws one `<g>` per visible layer under the stroke (gradients as `<defs>`, images
    as a `<foreignObject>` clipped to the outline, so `inlineMedia` inlines them on export like
    any `<img>`).
  - `fillLayersHtml` is self-contained so the poster view inlines it with `toString()`; one
    absolutely placed div per layer, image as `<img>` (exact focus/scale), tile as a repeated
    background, radial sized in container units to match the SVG circle.
  - `textPaint` turns the stack into CSS background layers clipped to the glyphs (top layer first,
    opacity folded into each colour's alpha, `background-blend-mode` per layer). A lone opaque
    solid stays a plain `color`, so old text renders unchanged. Title paints each line: `.li` is
    `will-change: transform`, and a composited child drops out of its parent's text clip. Picture
    opacity is not applied on text (CSS has no per-layer image opacity).
- `inlineMedia` inlines every `url()` of a layered background (it replaced the whole value with the
  first one).
- `resolveMedia` adds resolved `fills` to every media slot; the type grid view renders them. Docs
  that embed the old view source keep rendering their photos the old way until the poster is
  reinserted.
- `FillStack.svelte`: the Fill section, on the shell styles and the shared `ColorField`. Rows
  top-first, drag to reorder, swatch opens the layer, eye, layer opacity, type, + opens a type
  menu, −. Per type only its fields: colour + alpha; gradient bar with draggable stops (each with
  alpha), angle or centre/radius; picture grid, fit, focus, scale; blend. Used by
  `MotionInspector` (Fill section) and `PosterPartPanel` (photo part).
- Agent: `add_shape` takes `fills`; `set_props` describes fills for shapes, text and poster slots.

**E2E.** `tests/e2e/canvas-fills.spec.ts` (a box with gradient + picture + overlay and a filled
title render, stack edits persist; a poster photo takes an image fill and an overlay) and the
poster-parts photo test pass on production in the test-account mode. The poster-parts "layers
lists every frame" test fails on a strict-mode locator (two posters, two `poster#lines:1` rows),
not touched here.

**Discarded.** SVG `<pattern><image>` for picture fills: no arbitrary focus without the image size,
and `inlineMedia` does not inline SVG images.
