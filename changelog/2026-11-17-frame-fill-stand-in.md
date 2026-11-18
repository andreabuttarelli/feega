# A frame shows its page colour until it draws

A frame with no fresh poster drew a blank card (paper, or a grey pending block when too small to
read) until its source arrived and its vectors built: on the 36-page stress canvas the outer frames
stayed white for seconds, the same white for a dark page and a light one.

`standInFill(doc)` (`src/lib/motion/stand-in-fill.ts`) picks the solid colour of the page: the
largest root `Shape` covering at least half the frame with a visible solid fill (via motion-core's
`fillsOf`, so legacy `fill` and `fills: []` both read right), else the surface. It is stored in node
data as `standInFill` by `headPatch` (every saved revision) and by `frameStore.create` (every new
frame), so hosted gets it with the next revision of each frame. Local mode fills it in when a file
opens (`withStandIn` in the store's `seed`), so existing files get it at once. `docFace` passes it
as the card's `tint`; the frame surface fills its stage with it when there is no media, and
`showsStage` lets that card show even below the legibility threshold.

Not done: section bands (one colour per stacked section). One colour per frame was the free part.
