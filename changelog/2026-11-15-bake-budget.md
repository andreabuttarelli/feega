# Tile bakes sized to the frame budget

A gesture frame has 4 ms for tile bakes (`TILE_BUDGET_GESTURE_MS`), but the
credit only checked that some budget was left, so a 4×4 batch costing ~11 ms
on a heavy canvas ran anyway and made a ~15 ms frame.

`RasterCredit` now learns the cost per tile (`learn`, an exponential average),
shrinks batches to what the budget pays for (`side`) and bakes a batch only
when it can pay for it (`affords`; a single tile is always allowed at the start
of a frame so nothing starves).

On the user's canvas copy, uncapped moderate pinch: CPU 4× fps 122–136 → 143–147.
Desktop frames over 8.3 ms did not change (~100 per run): they are not bake
batches. A single ~120 ms frame shows up on dev as well, in 1 of 6 runs.
