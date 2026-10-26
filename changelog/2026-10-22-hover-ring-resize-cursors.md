# Stale hover ring after drag; Figma-like resize cursors

**Before:** on the GPU canvas the purple hover ring (`pickHover` in `GpuFlow.svelte`) kept the
rect computed at hover time. Dragging an element inside a frame, or the frame itself, left it at
the old place: the surface's idle `pointermove` kept recomputing it while a button was held, and
nothing cleared it on press.

**Now:** a press (`onDown`, `grab`) drops the hover ring; hover is recomputed only with no button
held, so after the drop it comes back from fresh bounds.

**Cursors:** `resizeCursor` (`src/lib/canvas/resize-cursor.ts`) picks ew/ns/nwse/nesw from the
handle's outward direction turned by the frame rotation. `FrameSelection` gets full-edge hit
strips plus cursors on handles and a rotate cursor; a selected tile/frame shows the corner cursor
via the surface `style:cursor`. Tiles still resize only by corners, so no edge zone there.

Guard: `tests/e2e/canvas-hover-ring.spec.ts`.
