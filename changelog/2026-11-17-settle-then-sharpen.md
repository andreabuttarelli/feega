# Canvas: a zoom stretches the level it has and sharpens once it settles

The owner saw "a ton of tile refreshes" while zooming, and a title split along a tile edge: half
sharp, half soft. New counters (`swaps`: the drawn level changed; `rebaked`: a tile baked again
within one gesture) measured it on the landings canvas, dense scenario, AC power. Per 10 s
gesture on dev:
- zoom at one spot: 2,663–3,313 tiles baked, 2,170–2,778 of them baked again, 77–79 level swaps;
- zoom and pan: 3,220–3,372 baked, 1,345–1,397 again, 43–48 swaps.

Most bakes were for zoom steps the gesture only passed through.

- `bakes_in_gesture`: during a gesture, tiles are baked only once the zoom has held still for
  120 ms. A pan at a steady zoom still bakes.
- `Tiles::gesture_frame`: while the zoom moves, or pauses, the frame draws a single level that
  covers the whole view (the finest one held), stretched. It never mixes levels, so the view
  switches from soft to sharp at once. A pan at a steady zoom draws as before, so content entering
  at the edge turns sharp as it is baked.

After, same scenario:
- zoom: 0 tiles baked, 9 swaps, 0 ms of fallback;
- zoom and pan: 1,103–1,143 baked, 337–395 again, 9–12 swaps.

Presented fps stays at 119.5–120 (zoom) and 119.6–119.7 (zoom and pan), with 0 frames over
33 ms. Time to sharp after zoom: 51–353 ms (dev 295–842); after zoom and pan: 502–939 ms (dev up
to 475). Noisy.

Cost: during a zoom the view is uniformly softer than before, because it stays on a coarser
whole level until the zoom settles.
