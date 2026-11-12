# Canvas: a dragged element is rastered once, then moved

Dragging an element inside a frame splits the frame into a rest layer and a moving layer
(`lifted-drag.ts`). The moving layer was sent to the core already held, because during a drag
`heldWhileMoving` holds every frame. A use that is held from its first put never gets a rest
position in the core's `World`, so `lifts()` never listed it and the core drew it in the overlay:
vello re-rastered the element at screen size on every frame of the drag (about 2 s of bake time
in a 4 s paced drag on the landings fixture).

`restedFirst` now sends the moving layer unheld once, so the core records its rest; from the next
frame it is held, shifted from that rest, and the core rasters its tiles once and moves them. It
rasters again only when the zoom step changes. The core's rule that a use held from birth stays in
the overlay is unchanged: it still covers uses that appear mid-gesture.
