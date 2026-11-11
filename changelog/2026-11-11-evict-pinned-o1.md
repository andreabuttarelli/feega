# Canvas: zooming no longer stalls on freeing tile memory

After #1955 (offscreen frames built and resident, whole canvas baked at one level) zooming the
landings canvas fell from ~58 to 10–41 fps. A CPU profile of a gradual zoom put 14.7 s of an
11 s gesture inside `Tiles::evict_beyond`: for every held tile, `pinned` asked whether the tile
belonged to the whole-canvas level, and `canvas_step` answered by building the full tile list of
the canvas at each of up to 41 levels and taking its length. Zoomed in on a wide canvas, one such
list holds hundreds of thousands of keys, and eviction asked once per held tile, every frame the
budget was exceeded.

The level is now counted arithmetically (`count_over`) and worked out once per eviction pass.
#1955's behaviour stays: offscreen frames are still built and the whole canvas still baked and
pinned. `evicting_thousands_of_tiles_zoomed_in_on_a_wide_canvas_takes_milliseconds` took 5.0 s
before the change and fails if it ever takes 200 ms again.
