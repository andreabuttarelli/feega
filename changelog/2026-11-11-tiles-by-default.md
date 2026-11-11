# Canvas: tiled renderer on by default

`TILES_BY_DEFAULT` is now true; `?coreTiles=0` (or `feega:coreTiles=0` in localStorage) turns it off.
The hybrid draws still views on the exact path and camera gestures from cached tiles baked ahead
(#1937), so a zoom composites textures instead of re-rastering the page.

Also here:
- Warm-up waits 500 ms after the last gesture or upload (was 150 ms): at CPU 4x a cold open was
  0.3–0.45 s slower than tiles off with the shorter wait.
- The frame loop is kept alive for the warm-up only once no frame is building: holding `pending`
  during the build delayed the vectors stage of a warm open by ~1.5 s at 1x.

Landings, CPU 1x, tiles off vs on (2 runs): zoom 30 / 84–118 ms → 58 / 18.4–18.6 ms (fps / p95),
fit 31 / 150 → 60 / 18.1–18.4, pan 59–60 → 60, drag 53 → 58, drag-element 55 → 58; time to sharp
1.59–1.68 → 1.45–2.15 s; edit 151–162 → 166–172 ms. Load 1x cold first 3.28–3.63 → 3.49–3.59 s;
warm all content 1.88–1.92 → 2.25 s (off shows partial content at 0.6 s, on at 2.25 s).

Open gaps (separate PRs): edit +10–15 ms; warm open first content later; coarse fallback when a
zoom starts while frames upload.
