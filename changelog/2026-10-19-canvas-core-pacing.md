# Core canvas: paced paint, pan inertia, texture residency

Under `?renderer=core`:
- `CoreFrames` paints through `FramePacer` (one paint per frame, none when idle) instead of a raw cancel/request rAF per change.
- Frame loading picks visible frames with `SpatialIndex.visible`.
- `resident` keeps vector-only frame groups always; frames with images are put on the GPU only while on screen and inside the device texture budget (`BUDGET.textureBytes`), largest first; others are `dropGroup`ed. Image bytes are estimated as image count × frame size × 4.
- Pan release starts a `Fling` glide (core only; the GPU canvas is unchanged). Any pointerdown or wheel stops it.
