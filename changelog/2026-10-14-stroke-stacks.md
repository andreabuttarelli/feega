# Stroke stacks on shapes, paths and text

**Before.** A Shape had one stroke (`strokeKind` none/solid/gradient, `stroke`, `strokeWidth`,
`dash`, `gap`, `cap`, `join`), always centred. The gradient kind ignored its own colour and read
the shape's old `fill`/`fill2`/`gradientAngle`, so after #548 it painted from fields the fill stack
had already replaced. Text had no stroke.

**Now.**
- `motion/stroke/model.ts`: `strokesSchema`, an ordered list (first = bottom) of
  `{paint, width, align, sides?, dash, gap, cap, join, visible}`. `paint` is a fill layer minus
  image. Widths are fractions of the short side, like the old `strokeWidth`. `SIDED` is the one
  table of which shape kinds take per-side widths (rect only). Old docs read through `strokesOf`:
  the legacy gradient becomes a linear paint from `fill`/`fill2`/`gradientAngle`, so it renders
  as before; nothing is written until the stack is edited. No DB migration.
- `motion/stroke/elements.ts`: component → which legacy fields the stack replaces in Properties.
- `motion/stroke/render.ts`: `ALIGN` table. Center draws as before (same markup); inside doubles
  the width and clips to the outline; outside doubles it and masks the inside out. Per-side widths
  draw an even-odd frame of the box. `strokeReach` replaces the old fixed miter reach in the
  filter extent. `textStroke` maps the first visible stroke to `-webkit-text-stroke` (`TEXT_ALIGN`
  table: outside = double width behind the fill via `paint-order`).
- `strokeGradient` and the `StrokeKind`-switch in `shape/render.ts` are gone.
- `StrokeStack.svelte` in the Stroke section (now also on text clips): rows top first, eye,
  width in px, editor for paint, position, dash/gap, cap/join, per-side.
- `add_shape` takes `strokes`; `set_props {strokes}` on Shape and text. `docs/mcp-tools.md`
  regenerated (no change: the motion tools sit behind `motion_tool`).

**Limits, declared.** Text draws one stroke (CSS has one `-webkit-text-stroke`); a gradient stroke
on text uses its first stop colour; inside on text draws centred. Per-side widths ignore corner
roundness and modifiers.
