# gpu-core: layers that did not change are not redrawn

A layer (blur, mask, matte, filter) was repainted and re-filtered on every frame even when the
clip behind it had not moved: in the asteroids doc the two blurred layers are identical in every
sampled frame (32 of 32 comparisons) while the plain paths move. The engine now remembers the
finished layer texture of an item whose content is only paths (no pictures, no backdrop), keyed by
the frame size and the item's full description, and reuses it. Up to 32 layers, dropped after 240
frames unused; a changed item simply misses and is painted again. Pictures, glyph/text, lens and
backdrop layers are never cached (their inputs change without the item changing).

Native (`frame_cost` cycling through 17 sampled asteroids frames / 9 mask frames, interleaved x3):

| frames | before | after |
|---|---|---|
| asteroids | 10.8 ms | 5.8 ms |
| masks fixture | 10.1 ms | 1.7 ms |

Pixels byte-identical: 53 frames over asteroids, masks, transitions, blur and mattes (some repeated
so they hit the cache) compared as PNGs against the build without the cache; a test renders a
layer, a changed one, and the first again.

Real editor (5 s sweep, fresh server per run, interleaved), canvas presents per second, wasm before / after:

| doc | before | after |
|---|---|---|
| effects fixture (16 filter layers) | 15.6, 17.0, 17.2 (22-26 fps, worst 133 ms) | 49.6, 48.6, 45.4 (60 fps, worst 17 ms) |
| masks fixture | 44.2, 42.4, 46.2 | 49.8, 52.2, 50.8 |
| asteroids-2d | 58.4, 59.4, 58.6 | 59.0, 59.0, 58.6 (already at the ceiling without load) |

Not done, with reasons: skipping fully transparent or off-frame layers: across the asteroids,
post, easing, supasito, motion-doc, split-headline and transition/blur/mask/matte frames sampled,
transparent layered items were 1 of 8 in the transitions doc at its first frame and none anywhere
else, and off-frame ones were never present, so there is nothing to win. Clipping blur passes to the
frame: layer regions are already intersected with the frame (`snapped` in `layers.rs`).
