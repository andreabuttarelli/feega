# Dash pattern arrays

Strokes gain `pattern` (up to 16 lengths, Figma `dashPattern` / SVG `stroke-dasharray` semantics: odd arrays repeat twice). When set it wins over `dash`/`gap`, which stay for old docs; `dashOf` is the one place that decides. `dashes` in the GPU outliner now walks any pattern, so the SVG DOM reader no longer drops strokes with more than two dash values (it used to mark them a paint gap). UI: Dashes text field in the stroke popover. MCP: `pattern` on strokes, or `pattern_px` through the px fields.
