# URL import: dashes, blends and gradient masks as layers

Dashed and dotted borders came in solid, blended blocks and blocks faded by a mask came in as
pictures (snapshots), so they could not be edited and used up the 48 snapshots a page gets.

## What changed

- Dashed/dotted borders and SVG `stroke-dasharray` become strokes with `dash`/`gap`. Chrome's
  pattern: dashed 3w/2w under 3 px, 2w/w from 3 px; dotted w/w (measured). Figma `dashPattern`
  now reaches the doc too (`scene.ts` `Stroke.dash`).
- `mix-blend-mode` on a block without element children becomes the clip's `blend`
  (`RestNode.blendMode`, Figma names, `scene.ts` `blendOf`). Blocks with children stay a backdrop
  snapshot: a clip's blend does not reach clips parented to it.
- `mask-image` with one `linear-gradient` (default size and position) becomes masks on the block,
  held together in a precomp: one `rect` mask per opaque run, one `linear` mask per fade
  (`scene.ts` `masksOf`, `figma-doc.ts` `masked`); the block clips to its box like the mask does.
  Image and radial masks stay snapshots.
- Auto width text no longer measures two lines in auto layout when its column is a hair narrower
  than its estimate (`resolve.ts` `reflowsText`): the stripe footer had a gap after every long link.
- The fidelity harness reads stylesheet fonts like the import does (`sheetFonts`): stripe was
  scored in fallback fonts.

Per page, layers that were snapshots or wrong (dash / blend / mask): stripe 35/2/1, framer 0/3/14,
webflow 0/0/3, vercel 0/4/0, linear 0/2/1, tailwind 1/0/0.

## SSIM (fold / full), HTML still, fresh capture `l1`

vercel 0.996/0.972, linear 0.986/0.978, stripe 0.989/0.979, apple 0.991/0.974, framer
0.987/0.968, webflow 0.989/0.957, tailwind 0.951/0.952, blog 0.974/0.965, feega 0.957/0.961. No page
lower than the capture before (`mine1` with this harness: stripe 0.993/0.980, framer 0.986/0.970).

## Discarded

- Blend on containers: the renderer blends one clip, not a subtree; it would blend only the
  background.
- Radial and image masks: the doc's radial mask is an ellipse fade from its centre, image masks
  need the picture imported as an asset first.
