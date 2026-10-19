# gpu-full draws custom components

Step 5 of the gpu-full roadmap (ADR 0018). The user's real videos are `Custom` clips: JS that
builds DOM. gpu-full now runs that JS in a sandboxed iframe (`allow-scripts`, opaque origin,
transparent, never shown), the same page `composeHtml` builds with `only` = the custom clips. A
probe inside the page seeks the timeline, walks each `#cc-<clip>` root and posts back a plain
tree: boxes measured with every transform switched off (fractional, untransformed), computed
styles, SVG geometry attributes, own text, and every `<canvas>` as an `ImageBitmap`.

`dom/read.ts` turns the tree into display-list content within a declared subset:

- boxes: position, 2D `matrix()` transforms about their origin, `opacity` on a leaf
- backgrounds: solid colour, `linear-gradient` (angles, `to` sides/corners, px/% stops), tiled by
  `background-size` (the grid of the photo poster)
- `border-radius` (circular corners, or a full ellipse), solid borders of one colour
- SVG `polygon` `polyline` `rect` `circle` `ellipse` `path` fills, `fill-opacity`, `fill-rule`,
  `viewBox` (meet)
- `<canvas>` (Three.js and other WebGL) as a `LayerItem`: the frame's bitmap is uploaded as a
  texture and composited by the gpu-full raster in paint order, not laid over it as HTML
- paint order: in-flow siblings before positioned/transformed ones

Everything else is named per element (`Unsupported.Dom`, detail `reason element ×count`): text,
media, filters, blend modes, clip-path/mask, overflow that would clip, opacity over a group,
strokes, SVG paint servers, box-shadow, z-index. A Custom clip whose DOM was not read yet is
`Unsupported.Unread`. Omitted strokes, shadows and text are "not drawn"; anything that would
change what is drawn (filter, mask, clip) drops the whole subtree.

Parity on the real fixtures (Chromium, Metal):

| Fixture | as-is | noise effect off |
|---|---|---|
| saturn-a0252066 (Three.js scene, 6 frames) | SSIM 1.0000, 0.00% off | — |
| saturn-aec7935d (iso blocks poster) | 0.0645 — clip skipped: `noise` effect | 0.8643, 7.09% off: text only |
| saturn-39cd5543 (photo grid in a precomp, frame in range) | 0.0942 — clip skipped: `noise` | 0.8148, 18.9% off: text + 2 clipped photo groups |
| saturn-299aece1 | empty doc, 1.0000 | — |

Discarded: reading `offsetLeft`/`offsetWidth` (integers, half-pixel errors); a same-origin
iframe (user code would reach the editor); approximating text with the browser's raster.
