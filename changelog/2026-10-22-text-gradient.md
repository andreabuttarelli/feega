# Gradient fills on text ranges

Whole text already took the fill stack (linear, radial, angular, diamond). Styled ranges
(`text-runs.ts`) took a solid `color` only.

- Run style `fill`: one gradient (linear, radial, angular, diamond; 2 to 8 stops). Setting `fill`
  drops the run's `color` and the other way round (`styledRange`). Equal gradients merge into one
  run; `rangeValues` reports `Mixed` when they differ.
- Choice, bounds: the gradient spans the glyph box of the range itself, not the whole text layer.
  Figma maps a ranged fill to the text layer box; we picked the range box because a gradient on
  two words of a sentence then looks like a gradient on those words. Two separate ranges with the
  same gradient each span their own box (the painter keys a unit per run start).
  Multi-line range: one box over all its lines, in the canvas and in the export alike where the
  browser slices the span the same way.
- GPU: ranged text already goes through the TS painter (`outlinedText`), whole-text through Rust
  only when the fills are native; `painter.ts` plans each run gradient (`gradientPlans`) and feeds
  the same shade code as whole-text fills, so angular wedges and radial squash work unchanged.
- Export: the span gets `textPaint` (`background-clip: text`, transparent fill).
- Properties: "Text · selection" has a Fill select (Solid, Linear, Radial, Angular, Diamond, Mixed),
  angle, stops with colour and position, add/remove stop. While editing, the range shows the
  on-canvas gradient handles (`GradientHandles`), placed on a measured mirror of the selection.
- MCP: `text_style` takes `style.fill` through `runEditSchema`; null drops it.

Not done: the textarea itself does not paint the gradient while typing (it does after commit);
image fills on a range.
