# Template thumbnails: Word field and Word silhouette readable

Reported: "all the thumbnails are missing in the gallery" after #2161.

Cause: no file was missing. All 51 canvas-gallery and 28 node-template
thumbnails exist and load (checked in the browser, `naturalWidth > 0`).
The blank cards in the PR screenshot were `loading="lazy"` images never
scrolled into view by a full-page capture. The real defect: the Word field
and Word silhouette previews were near-black (mean luminance 0.11 / 0.18).
The lion sample is dark and low-contrast, and rendering text effects at
480px samples the glyph atlas nearest-neighbour, dropping thin strokes
(T, I, L vanished).

Fix:
- `templates.test.ts` asserts every effect thumbnail has mean luminance
  above 0.2 (failed for both before the fix).
- Both templates get a look that reads: blue field, denser text, higher
  contrast. Users inserting them get the same look.
- `scripts/effects/template-thumbs.ts` takes a source per template: text
  effects render at 2.25x on the jellyfish sample, normalised, then
  downscale; pixel effects keep the 1x lion render (their files are
  byte-identical).

Discarded: making images eager (lazy is right for a 300-image page);
fixing glyph sampling inside the effect (separate behaviour change).
