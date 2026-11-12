# One draw bakes up to 4×4 tiles, during a gesture too

After a zoom-in the landings fixture took ~250 ms (p95) to turn sharp. A probe in `raster_batch`
showed why: a draw cost ~2 ms of CPU whether it painted one tile or sixteen (planning and layer
setup are per draw, not per pixel), and a gesture allowed one tile per draw under its 4 ms
budget, so a level of ~100 tiles needed ~50 gesture frames.

`BATCH_TILES` goes from 2 to 4 and `GESTURE_BATCH_TILES` (1) is gone: a gesture and a still frame
both bake square blocks of up to 4×4 tiles, nearest the centre first. Far-in level→sharp p95
250 → 50 ms, frames over 11 ms unchanged there.

Tried and dropped: an adaptive block side (grow under budget, halve over it). It measured the
same as the fixed 4×4 on every scenario. 6×6 and 8×8 blocks sharpened the far-in level slightly
sooner but added frames over 11 ms (GPU time grows with pixels).

Cost: zoom-sweep frames over 11 ms rise from ~58 to ~65 per run of ~1,130 frames; more levels
finish during the sweep instead of being superseded.
