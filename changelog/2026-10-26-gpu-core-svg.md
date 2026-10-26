# gpu-core reads svg text, arcs, masks, filters and projected pictures

The last refusals in the builtin templates were svg ones: arcs in path data (marquee logos, phone-chat, stacked-plus), `<text>` (diagonal-pills), hard-stopped `mask-image` (stencil-steps), and `<mask>` or pattern paint (metaball-listing).

- `parsePath` reads `A/a`, turning each arc into cubics with the SVG endpoint rules (radii grown to reach the end, compact flags).
- svg `<text>` gets its lines from `getExtentOfChar`, in the text's own user space, and is inked with its `fill`.
- A `mask-image` profile is split into edge fades (ramps, as before) and hidden bands (an inverted path mask).
- An svg that uses `<mask>`, pattern paint or an svg `<filter>` is rasterised whole by the probe, with computed paint inlined, the defs it borrows from other svgs, its own `url()` references kept, and its page offset dropped. It is left to the reader when it holds `<text>`, `<image>` or `foreignObject`, which an svg image cannot load.
- `<polyline>` is stroked open.
- A blur followed by an alpha threshold (goo) is filtered on the group as a whole, not per shape. With 62 shapes each filtered on its own, glyph-specimen came out black.
- `feFuncX type="discrete"` steps the colour on the core (Rust, wasm rebuilt) and in the WebGL filter.
- A bitmap under perspective, or in a clip turned in depth, is drawn as 6x6 tiles when the box affine misses by half a pixel or more. Each tile is fitted to its projected quad and cut to it.

Still open: 62 per-shape svg filters in one group still blacken the core frame (now avoided, but not fixed in gpu-core).
