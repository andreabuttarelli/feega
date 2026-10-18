# Angular and diamond gradient fills

`FillType.Angular` (stops, angle, centre) renders as a CSS conic gradient.
`FillType.Diamond` (stops) is four mirrored corner linear gradients, stops halved
so the last stop reaches the edge midpoints. SVG has neither, so on shapes both
paint through the outline clip with HTML like image fills (`PAINTED_AS` table).
Strokes refuse them (SVG strokes cannot carry HTML). Agent parity via `fillsSchema`.
Poster fixture regenerated: it inlines `fillLayersHtml`.
