# SVG import: gradients, rounded rects, clip paths, text, and files

Parity roadmap, rows on SVG import.

Before: pasted SVG kept only flat fills and sharp rects; gradients fell back to
black, `rx` was dropped, clip paths and text were ignored, and a dropped or
uploaded `.svg` file became an image node.

Now:
- `svg-import.ts` reads `linearGradient`/`radialGradient` (objectBoundingBox and
  userSpaceOnUse; stops, angle, centre, radius; `gradientTransform` and `href`
  chains are ignored) into a fill layer, `rx`/`ry` on rect into arcs capped at half
  the side, `clipPath` into a bounding box (shapes outside are dropped, axis-aligned
  rects are clamped, other shapes are kept whole: no boolean ops), and `text`/`tspan`
  into positioned text (size scaled by ancestors' transforms, weight, anchor, colour;
  a `tspan` with `y`/`dy` starts a line).
- `penPaint` turns the gradient into `fills`; the wire schema (`pastedSchema`) gained
  `gradient` on pen and `color`/`weight` on text boxes.
- `svg-drawings.ts` plans the canvas paste (one wire per shape/text, with its box),
  the page only posts them. In a frame, `frame-paste.ts` does the same inside the doc.
- Dropping or picking an `.svg` file runs the same path as pasting its markup; the
  drop point (or the view centre for the picker) places it.
- Text boxes use a fixed 0.55em advance: no font metrics offline, AutoWidth fixes
  the width after the first render.
