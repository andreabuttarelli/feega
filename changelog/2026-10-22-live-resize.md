# Live corner and side resize on the GPU canvas

Before: a free element's side handle (from #1111) fell through `grab` (elements
`dragsHost`) to the node Drag gesture and moved the shape; during a node resize the
selection used a contain-fit `frameSpace` while the core stretched the held texture,
so the box drifted from the shape; inside a frame a single-element scale went through
`dragPatch`, which scales around the anchor (centre), so the opposite corner moved and
side drags across their axis did nothing.

Now: `resizedAt` (gesture.ts) resizes a node by a unit handle (corner or side), with
Alt/Shift and rotation, keeping the opposite handle fixed in the world; tiles get side
hit zones (`resizeHandleAt`); an element's FrameSelection scale handles start that node
resize; the picker uses `FrameFit.Stretch` while a node is resized; untilted elements in
frames scale through the group path (`resizeFactors`, opposite-anchored). Tilted
elements inside a frame still scale around their anchor.

Guard: `tests/e2e/canvas-resize-live.spec.ts` (all four cases failed before the fix).
