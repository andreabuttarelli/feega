# Tiled canvas: dragged frames come from the tiles

Drag start stalled 0.6 s with `?coreTiles`: the app holds every visible frame during a drag and
each held frame left the tiles and was rastered into a texture on the first frame. Now a held
use that has not moved stays in the tiles (`World::lifted` compares with where it last sat in
the scene, `rest`). When it moves, its tiles are copied once (GPU copy) and drawn shifted and
clipped to the frame (`World::lifts`, `Snapshot`); only uses with no resting place (an element
lifted out of a frame) go through the overlay raster. Tiles under the old place are re-rastered
during the gesture so no ghost stays behind.

A/B landings, CPU 1x, 5 interleaved, flag on (variant with stale tiles never counting as cover):
drag worst 650→180 ms, drag-element worst 652→133 ms; drag p95 18.6→49.5 ms, fps 47→41; zoom
55→50 fps. The PR narrows the stale rule to the dragged frames' old place; one run only. Open:
~50 ms frames while a drag holds frames, not yet located.
