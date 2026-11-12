# Engine: tile raster budgets follow the display refresh

Tile raster budgets were fixed at 12 ms (still) and 4 ms (gesture, idle bakes) per frame, tuned
for a 16.7 ms frame: at 120 Hz the still budget alone overran the frame. `Refresh` reads the
display interval from `frame(now)` (shortest of the last 16 gaps, clamped 60–240 Hz) and
budgets 72% / 24% of it, so 60 Hz keeps 12 / 4 ms.

The JS camera paths (fit tween, glide, wheel batching, springs) were already time-based.
Budget bench A/B (3 interleaved rounds, load 15–88): fit and zoom within noise, drag
+0.2–0.5 pp; the uncapped bench reads a very short interval, so budgets shrink harder there
than on a real display.
