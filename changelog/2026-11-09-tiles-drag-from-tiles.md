# Tiled canvas: dragged frames come from the tiles

Drag start stalled 0.6 s with `?coreTiles`: the app holds every visible frame during a drag and
each held frame left the tiles and was rastered into a texture on the first frame. Now a held
use that has not moved stays in the tiles (`World::lifted` compares with where it last sat in
the scene, `rest`). When it moves, its tiles are copied once (GPU copy) and drawn shifted and
clipped to the frame (`World::lifts`, `Snapshot`); only uses with no resting place (an element
lifted out of a frame) go through the overlay raster. Tiles under the old place are re-rastered
during the gesture so no ghost stays behind.

Then the held-drag frames: the rest picture restarted every frame while anything moved (only the
camera counted as motion), costing one 25-35 ms block per frame. Rest now waits 200 ms after any
change, camera or not (`Compositor::stirred`, live overlay, lifts). Old-place redraw is one tile
per frame when no blank tile needs rastering; idle prefetch rasters one tile at a time; eviction
runs with 10 % hysteresis instead of sorting every frame; a picture-tier swap no longer counts as
a new frame.

A/B landings, CPU 1x, 5 interleaved, flag on, dev vs this (median [min–max]):
drag 49→58 fps, p95 18.4→18.4 ms, worst 617–633→101–118 ms; drag-element 49→58 fps, worst
600–617→65–84 ms; zoom 56→55 fps, p95 33.2→33.1; pan, fit unchanged; time to sharp 2.5→1.4 s.
