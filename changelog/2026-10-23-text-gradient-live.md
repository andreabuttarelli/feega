# Gradient text paints while typing

The inline editor (`CoreTextEdit.svelte`) drew the textarea's solid colour over the canvas, so a
gradient range showed white until commit. Browser check of #1157 (Playwright, real stack, test
account): picking, handle drag, commit and the radial whole-text case all landed in the doc and
on the canvas; only the live view was wrong.

- `gradientSpans` (`frame-text-edit.ts`) splits the text at the runs and styles gradient ones with
  `textPaint`, the same paint the export uses.
- While any range has a gradient, the textarea turns transparent and a mirror div below it paints
  the spans. Without gradient runs nothing changes.
- E2E: `canvas-text-gradient.spec.ts` (linear on a word with a handle drag, radial on the whole text).
