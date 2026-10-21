# gpu-core: layer and filter textures come from a pool

Every layer (blur, mask, filter, blend) painted into a fresh texture and every filter pass wrote
into another one, all dropped at the end of the frame. Fresh textures are zero-initialised and
allocated per pass; with 5 blurred layers that was most of the 11-14 ms the core spent on a frame
that only drew 5 paths. `FilterPasses` now keeps freed textures by size (`Pooled`, returned on
drop; at most 6 per size, 48 sizes) and `Gpu::paint` / `Runner::run` take from it.

Native (`packages/gpu-core/examples/frame_cost.rs`, GPU time without readback, interleaved x3):

| list | before | after |
|---|---|---|
| asteroids frame (5 blurred layers) | 14.4 ms | 13.6 ms |
| effects fixture (16 filter clips) | 54.4 ms | 42.1 ms |

Pixels are byte-identical (`cmp` of the rendered PNGs for both lists); a test renders a plain
frame after a blurred one on the same renderer and compares with a fresh renderer.

Real editor (`scripts/bench/editor-scrub.ts`, 5 s playhead sweep, fresh dev server per run,
interleaved), canvas presents per second, wasm before / after:

| doc | before | after |
|---|---|---|
| asteroids-2d | 42.8, 46.6 (54.7 rAF fps, worst 100-133 ms) | 58.4, 58.0, 56.0 (60.2 fps, worst 17 ms) |
| effects fixture | 8.0, 8.2, 9.4 | 14.0, 12.6, 15.4 |

`static/gpu-core` is rebuilt (`npm run build:gpu-core`).

Stalls in the DOM read round trip, traced (Chrome trace of a generative-doc sweep): the hidden
reader iframe and the hidden HTML player share one renderer process, separate from the editor page
(which is idle). That thread was 75-85% busy: component code ~0.7 s, the runtime's seek handler
~0.7 s, forced style recalcs ~0.3 s and the runtime's rAF ~0.25 s per 4 s, in busy stretches up
to 1.4 s. Reads queue behind them: that is the 250-600 ms. Not caused by the core draw (reads with
the draw disabled stall the same), by ImageBitmap transfer or by the reader's opacity. Deferring the
hidden player seek cuts the thread's work by ~14% and does not change presents per second.

Tried and dropped: downscaled blur (blur at half resolution, sigma halved, bilinear back up): the
extra passes cost more than the saved taps (asteroids 14.1 ms vs 11.5, effects 58.5 vs 53.3),
because per-pass overhead, not texel work, dominates. A workgroup-tiled blur was slower too.
