# Custom components: SVG groups, paint servers and clip-level effects in gpu-full

The photo-grid poster (fixture 39cd5543) left out two `<g clip-path>` photo groups: a blurred
facade of gradient-filled rects, stroked circles and a mesh pattern, then a noise rect blended
multiply. These pieces now go through the existing mask, filter and blend paths.

- **Group effects are a table** (`GROUP_EFFECTS` in `dom/read.ts`): `filter` → `clip-path` →
  `mix-blend-mode`, each one either passes the items through or names a gap. A `clip-path:
  url(#…)` with userSpaceOnUse shapes becomes an intersect mask on every item. A filter goes on
  each item when its primitives work pixel by pixel (blur, colour matrix, component transfer);
  any other filter, and a blend, are accepted on one item only. A box with hidden overflow
  whose content spills now clips it with a mask instead of being refused.
- **The probe ships the referenced defs** (`RawTree.defs`): every `url(#id)` in `clip-path`,
  `filter`, `fill`, `stroke` is serialised with its children.
- **Paint servers** (`dom/svg-paint.ts`): linear/radial gradients in objectBoundingBox units are
  drawn in unit space with the box folded into the matrix, so diagonal gradients on non-square
  shapes stay exact. userSpaceOnUse patterns of rects on a rect fill are expanded into runs, one
  contour per row or column when a child spans the tile.
- **SVG strokes**: caps, joins, one- or two-value dash arrays, solid or gradient paint.
- **Filters in linearRGB**: SVG filters without `color-interpolation-filters="sRGB"` now run in
  linearRGB like the browser (effect filters already ask for sRGB). Generators (turbulence,
  flood) get the filter region, the shape box plus 10% per side, which the noise stitches on.
- **Clip effects over the whole clip**: a clip with effects, masks, blur, a blend or opacity
  and more than one item becomes a `group` item. The WebGL2 raster paints its items into a
  separate target, then filters, masks and composites it once. Before, a grain effect ran on
  every shape and squared the alpha of anything translucent. The Rust core still skips group
  items.
- `-webkit-font-smoothing: antialiased` turns off the macOS stem darkening for that text.
- The parity harness hosts pages up to 4096 px, so `--ref=live` no longer crops tall docs.
