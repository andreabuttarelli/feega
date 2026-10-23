# SVG import keeps `fill-rule`

Pasting `designflow-logo.svg` (one path, two subpaths, `fill-rule="evenodd"`) drew a solid shape
instead of a rounded square with a triangular hole.

- Cause: `svgShapes` parsed every subpath correctly (commands, H/V, Z, second `M`) but never read
  `fill-rule`. `SvgShape`, `PenPaint` and the paste wire carried no rule, so the Shape clip kept
  its default `nonzero`. Both subpaths wind the same way, so nonzero filled the hole.
- Fix: `svg-import.ts` reads `fill-rule` (inherited down groups; `clip-rule` ignored) into
  `SvgShape.fillRule`. `penPaint` sets it as the Shape `fillRule` prop, `svgDrawings` puts it on
  the wire, `pastedSchema` accepts it. The GPU display list and the export markup already honour
  the prop, so nothing changes there.
- Tests: `svg-render.test.ts` pastes fixtures from `tests/fixtures/svg/` through both entry
  points (frame paste, canvas drop) and samples the GPU display list and the export markup with a
  CPU winding test. `svg-import.test.ts` covers rule reading, relative commands, arcs, S/T.
- Not changed: the GPU rasteriser itself, not sampled here (WebGL); checked in the browser.
