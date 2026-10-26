# Remembered GPU layers redraw their own pixels

The WebGPU engine keeps filtered/blurred layers between frames (`LayerCache`) and hands the same Vello image back on recall. Vello copies an override texture into its image atlas once and reuses the slot; after another frame filled the atlas, a recalled layer drew someone else's pixels or nothing. That is how the progressive blur bands appeared misplaced or cut on the core canvas while export was right. `a_remembered_layer_is_drawn_as_it_was_and_replaced_when_it_changes` was red on dev for this reason (GPU tests do not run in CI).

Fix: `recall` marks the override image dirty, so Vello recopies it from the kept texture. Discarded: dropping the cache (costs a re-filter per frame).
