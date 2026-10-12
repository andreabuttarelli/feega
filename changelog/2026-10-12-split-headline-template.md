# Split headline template (step 1, draft)

Sixth hand-made template: a one-line headline enters (shared word entrance), then an image or
video grows from zero width at the split point, pushing the two halves apart (expo in-out, no
overshoot), optional inner zoom, rect or pill mask, then closes and the words leave for a loop.

- Halves' positions are a function of the image's current width + gap, so they always hug it;
  shut, they sit one word space apart, so the line reads normally.
- The line stays centred: the image sits where the two halves balance.
- Text size fits the open row in 88% of the frame width (measured, re-measured on font load).
- Portrait (`stack: auto`): halves stack above/below with the image growing in height between.
  Scaling a row to fit 9:16 leaves a sliver image and small type; stacking keeps both big.
- `leave` (not `loop`: reserved by lint). No intermediate radius: rect or full pill only.
- Stacked on #426 (`word-entrance.ts`), itself on #425 (`custom-template.ts`).
