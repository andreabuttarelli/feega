# Strokes, shadows, fills and styles behave like a design tool

Props audit M7, M9, M10, H8, L3, L5.

- **Stroke 1 px (M9).** `addStroke` took the schema default, 1% of the short side: 2.4 px
  on one rect, 9.2 px on another. It now takes the short side and adds 1 px.
- **Stroke popover (M10).** Width was only in the collapsed row; the popover has a Width
  field, and Dash/Gap read "Dash length"/"Dash gap".
- **Pen (H8).** A pen path with no paint landed grey-filled with no stroke
  (`strokedPaint` returned `{}`). It now lands stroked in canvas ink with no fill, 1 canvas
  px (`PEN_STROKE_CANVAS_UNITS` 2 → 1, lines too).
- **Shadow (M7).** The drop shadow model keeps `distance`/`angle` and `x`/`y` (agents and
  styles store partial params and rely on the fallbacks, so the fallbacks are unchanged).
  A shadow added from the inspector is seeded `EFFECT_SEED` (X 0, Y 4, Blur 4, 25%), and
  `editedParams(kind, values)` hides Distance/Angle while distance is 0 (`SHOWN_WHEN`).
  "Softness" reads "Blur"; "Show behind" is a `flag` param drawn as a checkbox.
- **Fill on a stack (L5).** `addFill(..., FillHolder.Container)` starts white on a stack or
  a layer with children; any other layer stays black.
- **Create style (L3).** Four save buttons became one Create style menu.

Discarded: changing the drop shadow fallbacks to Figma's, which would have moved every
shadow an agent made with partial params.
