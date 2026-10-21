# A shape drawn over a frame becomes a clip of it

Drawing a box, circle or text from the bottom bar on bare canvas already made a free element (`kind: element`, no bar, no ports). Drawing one whose centre falls inside a frame still left a free element lying on top of it.

Now `saveDrawn` in the canvas page asks `frameHolding` (`src/lib/canvas/frame-holding.ts`) which frame holds the drawn box and, if any, reuses the `moveFree` action that dragging a free element onto a frame already uses. Chosen over a new `drawElement` parameter: one landing path for "element enters frame". The pen is unchanged (no box, stays free). Undo is two steps: the draw, then the move.

Spec: `tests/e2e/canvas-free-insert.spec.ts`.
