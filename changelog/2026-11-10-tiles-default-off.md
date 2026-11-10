# Tiled canvas back behind ?coreTiles

Tiles were made default before measuring load. On the load bench (landings, 2 runs) tiles-on
still lags flag-off after #1897: at 1x warm "sharp" 2.5-2.8 → 3.9-4.1 s and cold vectors
3.4-4.7 → 6.3 s; at 4x warm first 2.2-2.6 → 4.3-5.1 s and sharp 7.8-8.2 → 12.9-13.1 s. Gestures
stay far better with tiles. Until loads match, `TILES_BY_DEFAULT` is false: `?coreTiles` or
`localStorage['feega:coreTiles']='1'` turns tiles on. Next: use the exact retained path while the
view is still and content is landing, tiles for gestures.
