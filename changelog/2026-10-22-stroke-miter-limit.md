# Stroke miter limit

Strokes gain `miter` (1..100, default 4, SVG `stroke-miterlimit` semantics = Figma `strokeMiterLimit`). Before, the GPU outliner hard-coded 4 and the SVG export used the browser default, so the value could not change.

- Export: `stroke-miterlimit` emitted only when not 4, so existing output is byte-identical.
- GPU canvas: `strokePolygons` takes the limit; display list and the SVG DOM reader both pass it, so canvas and export bevel at the same angle.
- MCP: `strokesSchema` carries the field, so `edit` ops accept it with no new op.
- Figma's REST `strokeMiterAngle` (degrees) was not adopted: the limit is the Plugin API and SVG unit.
