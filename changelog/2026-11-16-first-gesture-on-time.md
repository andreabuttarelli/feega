# Canvas: render blocks sized to the frame, rest yields to input

Follow-up to the gesture frame deadline. A 256 px fallback, look-ahead or rest block still cost up
to 37 ms on dense pages, so one block could overrun a 4 ms gesture frame. Rest sharpening also
ran a whole block even when input was already waiting.

- `BlockSizer` (tiles.rs) learns cost per pixel from each block drawn. It rises at once on an
  expensive block and eases down by 25% on cheap ones. It picks the largest block, in 32 px steps
  from 32 to 256, that fits the frame budget; 128 px before anything is measured.
- `Rest::sized` cuts a view into blocks of that side. The fallback and look-ahead use one sizer;
  rest uses another, because rest blocks draw at full quality.
- `raster_rest` returns once a block is drawn if input is pending (`input_pending()`), so a
  gesture that starts while the view sharpens is not held behind it.
- The first idle frame after load draws the overlay once and creates the screen pipelines
  (`Premultiplied`, `Over`), so the first gesture does not.

Measured on the landings canvas, production build, back to back with the previous branch (laptop
on battery):
- cold first zoom, worst engine frame per load: 8–18 → 7–8 ms;
- presented worst per load: 33–50 → 25–33 ms;
- zoom and pan stay at about 119 fps;
- time to sharp is noisy, with no clear change.

Still missing 120 Hz in the uncapped bench:
- single tiles at a new zoom step whose vello encode costs 20–143 ms (dense pages, CPU in
  `render_to_texture`, plan and effect prepare);
- effect-heavy fallback blocks of 18–36 ms even at small sizes. Their cost is per effect
  layer, not per pixel.
