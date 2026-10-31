# URL import: pages come in as stacks

Imported pages were absolute below the section level (60–66% of layers
on stripe, linear, vercel). `page-stacks.ts` now rebuilds each frame as
stacks from geometry, with rule tables: blocks that don't overlap along
an axis stack; uneven gaps nest at the largest gap; grids become rows;
wide rows spread and fill; frames as wide as their parent fill. Overlays
(a box inside a sibling, a leaf backdrop under everything), opacity,
vector drawings and clipping frames with absolute children stay
absolute. Lines of one paragraph merge into one text. Paint order is
kept. Gaps and even paddings bind to spacing variables.

Engine fixes found by bisecting renders against the page:
- `figma-doc`: a frame inside an auto layout is now a container with its
  own box (`Background.InFlow`), not a group sized by what overflows it
  (columns drifted 2 px each).
- `text-extent`: hug height reads `lineHeight`/`letterSpacing` in px,
  not only `leading` (one-line texts were 19.5 px instead of 24).
- Figma `textAutoResize: NONE` maps to fixed text; a fixed text one line
  tall gets `textWrap: none` (new value), so it never wraps when the
  engine measures it wider than the browser did.
- Stacked texts: one line in a column hugs; rows and multi-line keep
  their box.

Result (same capture, fold/full SSIM, absolute share):
linear .989/.971 → .989/.971, 58% → 10%;
stripe .969/.888 → .981/.897, 66% → 14%;
vercel .980/.972 → .980/.970, 62% → 17%.
Blocks a code import already marks as components (`use`) keep their
structure: stacking them lost nested instance text overrides
(`code-doc.test.ts`), cause not isolated.
Discarded: hugging all text (moves sections), fixed text everywhere
(wraps), stacking clip frames with absolute children (render differs).
