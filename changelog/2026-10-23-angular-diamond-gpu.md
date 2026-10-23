# Angular and diamond fills on the GPU core

A shape with an angular or diamond fill vanished on the GPU core: `display-list.ts` had no paint
for them, so the whole clip came back `Unsupported.Fill` and nothing was drawn. Text drew them
with approximations (120 linear wedges, four clipped quadrants).

- New paints `sweep` and `diamond` in the display list (`paint.ts`, `display_list.rs`). Angular →
  vello sweep gradient, start at CSS `from` (0° = up, clockwise), `Extend::Repeat` so a start
  below 0 wraps. Diamond has no vello brush: `Canvas::fill` clips to the shape and fills four
  quadrants with linear ramps whose iso-lines are `|dx|/hw + |dy|/hh` — the export's CSS.
  Backends now implement `fill_plain`; `fill` is the trait default.
- Text uses the same paints; the wedge/quadrant approximations and `Shade.clip` are gone.
- JS WebGL raster (`raster.ts`) gets the two kinds in its shader. Vector SVG export names them as
  skipped (SVG has no conic).
- Figma paste keeps `GRADIENT_ANGULAR` (angle + centre from the paint transform) and
  `GRADIENT_DIAMOND` instead of reporting "drawn as linear/radial". SVG import reads Figma's
  `data-figma-gradient-fill` plus the conic `foreignObject` it exports, so angular/diamond
  survive there too.
- Tests: Rust pixel tests for both paints (`tests/render.rs`), display list on rect/ellipse/path,
  Figma and SVG import. E2E `canvas-conic-fill.spec.ts` shoots canvas vs export.
