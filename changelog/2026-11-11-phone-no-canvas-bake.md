# Phones skip the whole-canvas bake and offscreen residency

#1955 bakes the whole canvas into up to 320 never-evicted tiles (~86 MB) and
keeps offscreen frames with images resident up to the texture budget. On a
phone both are memory the tab cannot spare.

`BUDGET` gets two columns: `canvasTiles` (desktop 320, phone 0, sent to the
core with `setCanvasTiles`) and `offscreen` (desktop `Resident`, phone
`Dropped`: only frames in view keep their images, as before #1955). Desktop
values are pinned by the profile test; the wasm default stays 320.
