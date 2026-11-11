# Perf: tiles kept on disk across sessions (draft, regresses today)

Finished tiles (at rest, every frame they touch shown whole) are read back from the GPU,
encoded to WebP in a worker and stored in OPFS (IndexedDB fallback), keyed by canvas, theme,
DPR, tile step/coords and a hash of the content key and box of every layer the tile touches.
On open the view and coarse tiles are decoded and uploaded as held tiles, immune to loading
damage until the frames are whole; a revision change or an edit forgets them at once.
LRU cap 500 MB desktop, 150 MB phone; deleting a canvas drops its tiles.

Measured on the landings fixture (1x, 3 runs, warm): restore hits, but the view is never fully
covered and the open gets slower (all-vectors 0.5 → 1.6 s, sharp 2.6 → 4.2 s): while imports
are held the engine stays on the tile path and skips the rest raster. Not ready to merge.
