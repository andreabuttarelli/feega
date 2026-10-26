# gpu-core reads repeating, offset, blended and text-clipped backgrounds

The DOM reader refused three backgrounds still used by builtin templates: `repeating-linear-gradient` (pixel-burst, type-grid), a gradient moved by `background-position` (prompt-input's shimmer) and `background-clip: text`. Repeating gradients are cut into per-period bands, merged per colour, plus two-stop ramps for soft segments; tiles start at the CSS offset; text clipped to its background takes the gradient as its ink.

Found on the way, all silent (no gap reported):

- vello stretches a gradient's first stop down to 0 and its last up to 1, so `#3a3a3a 98%, transparent 100%` drew as a soft blob. `css.ts` now spells the end colours out.
- `background-blend-mode` was never read; layers now blend inside an isolated group.
- `::before`/`::after` were invisible to the reader. The probe stands each one in as a span with its computed style while it reads, then removes it.
- The probe split background layers on every comma and cut a url() at its first quote, so a data-url noise texture with `url(#n)` inside loaded `#n`. That is why saas-monitor's grain was missing (0.967 → 0.996).
- url() textures were repeated at their natural size and the pattern scaled, which blurred svg specks and scratches. Each tile is now drawn at its CSS size first (block-title against the live page: 0.87 → 0.99).

Rejected: rasterising unreadable backgrounds through an SVG `foreignObject`. Safari taints the canvas, and the native path also covers the cases above.
