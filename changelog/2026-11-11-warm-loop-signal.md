# Tiles: the warm-up keeps the frame loop alive without reporting pending

Keeping the frame loop running for the tile warm-up set the core's `pending`, which the frame
pipeline also reads as "the core is busy": the vectors stage of a warm open waited for it. The core
now reports `warming()` separately; `CoreFrames.svelte` continues the loop on it, and `pending`
means only real raster work again.

Load, landings, tiles off vs on (2 runs): CPU 1x warm first content 0.67–0.94 / 0.67–1.56 s (was
2.25 s on), all 1.87–1.92 / 1.90–2.03 s; CPU 4x warm first 2.3–3.8 / 2.8–6.0 s (was 6.9–7.0),
all 5.8–5.9 / 6.3–6.7 s; cold equal within noise.
