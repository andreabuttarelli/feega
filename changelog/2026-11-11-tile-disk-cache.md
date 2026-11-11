# Perf: tiles kept on disk across sessions (draft, no gain yet)

Finished tiles are read back from the GPU, encoded to WebP in a worker and stored in OPFS
(IndexedDB fallback), keyed by canvas, theme, DPR, tile step/coords and a hash of the content key
and box of every layer the tile touches. On open the view and coarse tiles are decoded and
uploaded as held tiles that ignore loading damage; each tile is handed back to the engine as
soon as the frames under it are shown whole, and dropped at once on an edit or revision change.
Frames fully under restored tiles count as drawn for the splash. Saving waits until every frame
is whole and the engine is idle. LRU cap 500 MB desktop, 150 MB phone; deleting a canvas drops
its tiles.

Landings, 1x, 3 runs, `?noTileDisk` vs on:
- cold: neutral (first content 4.5–6.6 s vs 4.2–6.4 s);
- warm: no gain, sharp 2.4–2.7 s vs 2.9–4.3 s, one run first content 0.65 → 2.6 s.

Saving during load slowed cold opens by ~1.5 s (GPU readbacks competing with raster); now
deferred. Restoring held tiles keeps the engine on the tile path and off its exact rest raster,
which is where warm opens lose time. Not merged.
