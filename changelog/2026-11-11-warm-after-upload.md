# Tiles: warm-up waits longer after uploads than after gestures

Reopening the landings canvas at CPU 4x showed all frames about 0.5 s later with tiles on than off:
the tile bake started 500 ms after each upload and competed with the uploads still arriving.
Uploads now postpone the warm-up by 1.5 s (`Warmup::uploaded`); gestures keep 500 ms, so tiles
around a view are still baked soon after a zoom. A later stir never shortens a pending wait.

Load, landings, CPU 4x, 3 runs, tiles off / on: warm all content 5.72–5.89 / 5.66–5.93 s, sharp
6.92–7.14 / 6.83–7.13 s; cold first 8.09–8.41 / 8.19–8.48 s, sharp 9.17–9.69 / 9.39–9.89 s.
