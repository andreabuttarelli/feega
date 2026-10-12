# Split headline template

Sixth hand-made template: a one-line headline enters (shared word entrance), then an image or
video grows from zero width at the split point, pushing the two halves apart (expo in-out, no
overshoot), optional inner zoom, rect or pill mask, then closes and the words leave for a loop.

- Halves' positions are a function of the image's current width + gap, so they always hug it;
  shut, they sit one word space apart, so the line reads normally.
- The line stays centred: the image sits where the two halves balance.
- Text size fits the open row in 88% of the frame width (measured, re-measured on font load).
- Portrait (`stack: auto`): halves stack above/below with the image growing in height between.
  Scaling a row to fit 9:16 leaves a sliver image and small type; stacking keeps both big.
- `leave` (not `loop`: reserved by lint).
- Review 1: expo in-out is the only curve. The open overlaps the title settle (0.35 s) so the
  slow expo start doesn't read as a frozen pause; the image fades in over its first 10% of width
  so no 1px sliver shows. Corner radius field (default 7% of image height, 50 = pill): user
  decision, overriding the sharp-or-circle rule for this video template. Text 13.5%, image
  1.7em at 1.8 aspect.
- Ship: key fields `SPLIT_KEY_FIELDS` (headline, media, colours, radius) exported for the
  component-browser contract, not on dev yet. Variants rendered: dark 16:9 photo, light 9:16
  stacked, 1:1 video in a pill; 0 jolts, seam 0, reseek 0. The render script fails on
  `__feegaErrors`.
- Stacked on #426 (`word-entrance.ts`), itself on #425 (`custom-template.ts`).
