# Figma paste never refuses

Before: a Figma node type outside `layerOf` in `src/lib/canvas/figma/scene.ts` (sticky, table,
embed, shape without geometry...) was dropped. A paste made only of such nodes produced no plan,
and the page showed "These Figma layers could not be read".

Now `placeholderOf` returns a grey rectangle at the node's box and reports it; the existing
non-blocking notice lists what was approximated. Nothing is rasterised: Figma does not put
renders in the clipboard.

Tests in `archive.test.ts`: landing frame with sticky/table, unsupported beside supported,
only unsupported.

Not reproduced: "loose layers become a frame". `DESTINATION` routing, `pasteFigmaAt` and the
`element` node type are intact since #1203/#1212 and covered by tests; no real loose-layer
clipboard fixture exists (only `clip-1.html`, a frame).
