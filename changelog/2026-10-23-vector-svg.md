# True-vector SVG and PDF

The SVG row of an image export was the composed HTML page frozen inside a `<foreignObject>`: live
text, but Illustrator and Figma cannot parse it, and nothing in it was a path.

- `src/lib/motion/export-svg.ts` writes the display list (the same one the GPU core draws) as SVG:
  paths with their matrix, solid / linear / radial fills as gradients, even-odd and nonzero rules,
  inside and outside stroke alignment (clip paths), blur, wipe scissor, rectangle/ellipse/polygon
  masks (add, or intersect/subtract stacks), inlined pictures. Text is outlined by the core's
  text engine, so no font is needed to open the file.
- What it cannot write is left out and named: blend modes, effects and filters, mattes, gradient
  and picture masks, feathered masks, live (DOM) components, pictures with a focus or zoom.
  `svgOf` returns `skipped`; `exportSelection` returns it deduplicated; the dialog, CLI and MCP
  `export_selection` show it.
- PDF pages use the same SVG, so a PDF is vector too. No browser is needed for SVG any more;
  PDF still prints through Chromium.
- Server side: `vector-list.ts` builds the display list with the fonts the doc uses
  (`fontLoader`) and inlines pictures as data URLs. An element export crops the view box to the
  box the element and its children cover.
- Removed: `freezePage`, `svgDocument` and `ExportPage.freeze`.
- Checked: SVG of a doc with gradient shape, outlined text and a masked ellipse parses with
  `xmllint`, has no `foreignObject`, and renders in Chromium
  (`~/Documents/feega-videos/e2e/export-svg-vector.png`).

Not done: embedding the text as `<text>` (outlines only), stroke dash and arrowheads are drawn as
filled bands, not as stroked paths.
