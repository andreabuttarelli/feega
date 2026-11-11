# Tiles: far coarse levels warm while uploads still arrive

A zoom started while frames were still uploading fell back to nothing outside the held picture: the
whole bake waited 1.5 s after the last upload. The far coarse levels (one table row each: two to
four doublings coarser, plus the reserve) are a few dozen small tiles, so they now warm 500 ms
after the last gesture even while uploads continue (`Warmup::coarse_due`, `Tiles::coarse_ahead`).

Landings, tiles on, zoom right after open, recording inspected: no white or empty frames at any
zoom-out (`~/Documents/feega-videos/perf/coarse/zoom-sheet.png`). Load at CPU 4x, tiles off / on:
cold first 8.21–8.48 / 8.13–8.48 s, warm all 5.88–6.03 / 5.83–6.09 s, sharp within 0.15 s.
