# Timeline draws only the rows in view

Selecting a landing frame (270 clips) mounts the inline editor, and the timeline rendered every
row: three icon buttons with tooltips each, plus `ancestorsOf` and `parentName` scanning every
clip per row. A Chrome CPU profile on a production build put it at ~110 ms of the ~300 ms
select/open; event latencies on select and context menu were 232–320 ms.

`rowWindow` (`timeline-layers.ts`) picks the rows intersecting the scrolled viewport, plus six of
overscan, by binary search on the row tops `layerRows` already computes; spacers keep the scroll
height. Before the viewport is measured it assumes 720 px, so the first paint never draws all
rows. `revealLanes` scrolls an off-window lane in before `scrollIntoView`.

After: worst select/menu event 320 → 208 ms; the timeline is gone from the profile. What remains
is the auto-layout pass, recomputed by every consumer of the doc.
