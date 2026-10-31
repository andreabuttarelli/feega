# URL import: flatten without hiding engine gaps

Follow-up to `2026-10-31-url-import-flatten`. Wrappers were kept because
they hid engine gaps; those are fixed instead.

- Box minimum: `MIN_BOX` (motion-core `components.ts`, keyframes,
  `figma-doc`) was 0.02 width / 0.002 height of the doc, i.e. 25 px /
  29 px on a tall imported slice. A label without its wrapper grew to
  that and pushed its stack. Now 0.0005 / 0.0001.
- Labels: a one-line text alone in a wrapper inside a stack takes the
  wrapper's box, fixed (one-line fixed text never wraps since #1655),
  aligned left/centre/right by where it sat, line height = text height
  + 2 x top offset so the glyphs stay put. A wrapper already at the
  text's box keeps the text's alignment. Not when the wrapper leaves
  the page (the schema refuses the text). Multi-line texts keep their
  wrapper: widening them would re-wrap.
- Vectors: shapes are drawn from path bounds, so an icon's frame held
  its box. A vector moved into a stack now carries its box as a
  zero-area anchor subpath (`M 0 0 Z M w h Z`). Adjacent sibling
  vectors with the same box, paint, opacity and fill rule join into one
  vector. Different paints stay separate: a Shape clip has one paint.
- Clipping: a clip keeps a wrapper only when a descendant overflows it.

The earlier "text in a stack drops fidelity" finding was a measuring
artefact: the worktree used the main checkout's motion-core, which
rejected `textWrap: none` and left every fixed text unstyled.

Capture d11, layers saved vs. no flatten (dev → this), fold/full SSIM
(dev → this):
vercel 35% → 42%, .9934/.9660 → .9941/.9663;
linear 7% → 26%, .9894/.9784 → .9894/.9786;
stripe 7% → 16%, .9931/.9661 → .9932/.9695.
Stripe's remaining layers are mostly vectors with different paints and
nested stacks with different gaps.
