# Free text fits its words while you type

Typing in a free text clipped the last words and the box jumped in width.
The fit that sizes the node to the text read two things taken at different
moments: boxes measured on the previous stage size, and the doc already
resized to the new one. Fractions of the old stage were multiplied by the new
stage width. A second source: the first measure after a resize happens before
the font has swapped in, so a fallback width was fitted and then corrected,
each round resizing the node again.

- A measurement now carries the stage it was taken on; `MotionPreview.measure`
  returns nothing when it is not the current doc size.
- The host fit waits for measurements to be quiet (300 ms) and is dropped when
  the doc size changed since the boxes were taken.

Test: `tests/e2e/canvas-text-typing-fit.spec.ts` (real stack). Discarded: a
leading-edge throttle (still applied the fallback-font measurement).
