# Tiled canvas: tile store sized by memory, screen tiles pinned

The tile store kept a fixed 320 tiles: on a large real canvas it evicted tiles in or near the
view and rastered them again. Now the cap is 12 screens of tiles, at most 384 MB of tile textures
(`tiles_kept`); tiles on screen at the current step plus one ring, and the coarse reserve around
the view, are never evicted; the rest go least-recently-drawn first, farthest first on ties.

One landings run, CPU 1x: pan 60, zoom 57 (p95 18.8), fit 57 (p95 18.8, was 33), drags unchanged;
settle watch green.
