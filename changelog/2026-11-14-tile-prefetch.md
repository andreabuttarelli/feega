# Tile pyramid: overview pinned, bounded debt, bake-ahead

Measured on a 33-landing wall (15k layers): zoom-ins blurry 1–2.4 s, the
overview coarse for >500 ms after returning, 100–300 ms stalls.

- **Overview pinned.** The level covering the whole canvas was pinned only
  while in the current plan; eviction could drop it. Now every step at or
  below the overview level survives eviction.
- **Raster debt capped at 3 frame budgets.** A 300 ms coarse bake left 75
  frames of debt at 4 ms/frame: no bakes for >1 s while tiles stayed coarse.
  That was the "0 bakes in flight" case, not the `resting` gate (bakes of the
  missing queue run every tiled frame regardless of `resting`).
- **Bake-ahead.** During a gesture, leftover credit bakes the tiles the view
  will need ~6 frames ahead (camera extrapolated: zoom geometric, centre
  linear) — finer level near the anchor on zoom-in, motion side on pan.

Not done: the stalls themselves are single coarse bakes (50–300 ms) of
thousands of layers; cutting their cost needs engine work.

## Second pass: cost of coarse bakes

- **Backdrop blur scales with zoom.** `backdrop` sigma was never scaled
  by the use matrix (only `blur` was): at overview a 20 px glass blur ran
  a full backdrop pass per item. Now scaled, and dropped under 2 device px.
- Batches sized by measured cost were tried and reverted: max frame
  300 → 100 ms, but blur on overview legs got worse.
- A single coarse tile still costs 50–90 ms. Next: build coarse levels by
  downsampling finer tiles on the GPU instead of re-rendering.
