# SVG import: masks and `<use>`

`svgShapes` ignored `<use>` (shapes in `<defs>` never drew) and `mask="url(#…)"` (masked
content drew whole). `<use>` now resolves to id'd shapes with inherited fill/stroke. The engine
has no mask, so masks are baked: Clipper intersection of the shape with the mask geometry.

Not supported: luminance/soft masks, mask region, masks on strokes, `<use>` of groups/symbols.
