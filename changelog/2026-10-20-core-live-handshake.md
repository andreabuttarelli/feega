# Core canvas: hand a frame to the live editor only when it is really on screen

The user's `coreDebug=1` log showed the landing frame as `layer=real why=live editor` at the
moment it was blank: #1022's `hidden` removed it from the core because the frame was in `domIds`
and the DOM tile had fired `TILE_PAINTED`, but the live editor was not actually showing it at that
zoom.

Now the core hides a frame only when (1) the canvas is in frame-editing context (an element inside
a frame is selected), not for a plain selection or hover, and (2) `liveShown(id)` confirms, at
paint time, that the live editor's `.gpu-dom-node` is shown (not `unshown`) and has a non-empty
rect overlapping the canvas (`liveCovers`). Otherwise the core keeps drawing it, so at worst the
frame is drawn twice, never zero times. The handover resumes by itself: `hidden` and the DOM
state invalidate the paint.

Vello's bump report is not added to `coreDebug`: vello 0.11 only reads the bump allocators back
with its `debug_layers` feature, so the overflow theory stays untested.
