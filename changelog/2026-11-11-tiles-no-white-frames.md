# Tiles: no white or empty frames while zooming, levels baked ahead

Behind `?coreTiles`. Zooming right after a canvas opened showed frames as white boxes or bare
canvas for many frames: the tiles were never warmed (any upload or raster postponed the warm-up by
a second, and a canvas loads for several seconds), so a zoom fell back to nothing, and the overlay's
frame fills showed white where tile content was missing.

- Warm-up starts 150 ms after the last gesture or upload (was a second after any upload, raster
  or gesture). Not waiting for uploads at all made the canvas load 2.5–4.5 s slower at CPU 4x (the
  bake competed with loading), so uploads still postpone it.
- The idle bake is one table (`BAKED` in `tiles.rs`): 1.5× the view at the current step, the view
  one doubling sharper, 2.5× one doubling coarser, 9× three doublings coarser and 17× four
  doublings coarser. Baked tiles in their area are pinned against eviction.
- The exact screen picture held before the gesture is drawn under the current-step tiles and over
  the fallbacks while it is no softer than 1.25×, clipped to the area it covers.
- A tile rastered while its frame was still building does not replace a held texture, is dropped
  where other tiles cover it, and stays queued otherwise.

Landings, CPU 1x, tiles on, recordings inspected: no white blocks during zoom; before, frames
27–34 of a zoom were white boxes at overview. Gestures fps / p95: pan 59–60 / 18.3, zoom 56–57 /
18.5, fit 57–58 / 18.5, drag 58–59 / 18.4 (tiles off on the same build: zoom 30 / 83–101).

Load bench, CPU 4x, tiles 0/1: equal to dev (cold first content 7.6–7.8 s, sharp 8.7 s).
Trade-off kept: a zoom started while frames are still uploading falls back to coarse levels until
the bake runs.
