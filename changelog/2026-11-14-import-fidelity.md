# Import fidelity: traidue.com fixes

A fidelity check of a code import of traidue.com (SSIM per page at 1280 px)
scored 0.42–0.96. Fixed here:

- **Frame cuts** (`url-doc.ts` `cutsOf`): boards are cut every 16384 px. A part
  taller than one frame now starts the next frame, instead of the fixed cut
  landing 9599 px into /wiki. A page taller than 16384 still needs two frames:
  the frame limit is unchanged.
- **Text runs** (`text-runs.ts`): runs had a 0.005 size floor, the text 0.001.
  On a 16000 px board a 16.8 px link run fell under it, the style failed and the
  text fell back to black default type. Runs now share `TYPE_SIZE`.
- **Rounding** (`figma-doc.ts`): stroke widths and type sizes were rounded to
  1e-4 of the frame — 1.6 px per step on a 16000 px board. Now 1e-7.
- **Hover** (`browser.ts`): after a click the pointer moves off the page, so
  whatever slides under a dismissed cookie banner is not captured hovered.
- **Truncation** (`page-tree.ts` → `maxLines` → Text `maxLines`+`truncate`):
  `-webkit-line-clamp` and `text-overflow: ellipsis`.

Not fixed, diagnosed: the header search input vanishes on every page where the
navbar is a component instance. Inlining the nested SearchInput instance in the
Navbar main makes it render, so the defect is in rendering a nested instance
inside a component main, not in the capture. Home: the map hero height follows
the viewport height and the article list order is data-driven. List markers,
image radius, the clipped badge are still open.
