# Canvas: tile production stays inside the gesture frame

The owner reported zoom well under 30 fps, with hitches whenever new tiles loaded. On the
real-sites canvas (landings fixture, local mode), continuous pinch zoom across octaves presented
88.8–93 fps at 120 Hz: 119 frames over 16.7 ms, 56 over 33 ms, the longest at 342 ms. Engine
counters (a new `fallbackMs` counter per frame) put 180 of 204 long frames on `serve_bare`, the
never-blurry fallback from #2220. With no budget, it drew whole screen bands at full resolution in
one frame, 50–326 ms each. The rest were bake batches, whose 4 ms budget was checked only between
batches.

`tiled_frame` now sets one deadline per frame: 4 ms in a gesture, 12 ms at rest. Bakes, the
fallback and the look-ahead all check it.
- Gesture bakes go one tile per batch, so the clock is checked per tile.
- The fallback queues its bands as 256 px blocks (`Fallback.todo`). It draws blocks until the
  deadline and resumes them next frame.
- `render_ahead` stops at the earlier of the deadline and its own 6 ms.
- Until a block is ready, the region shows the coarser level `beneath`, stretched.

The rest path is unchanged: `raster_rest` still makes the view exact once the gesture stops.

Measured zoom on landings, 3 runs, vsync on, trace presented frames:
- presented fps 88.8–93 → 115.4–119.9;
- frames over 8.3 / 16.7 / 33 ms: 285 / 119 / 56 → 42 / 7 / 2;
- longest gap 342 → 108 ms.

Pan was already at ~119 fps and is unchanged. Time to an exact frame after the gesture: zoom
44–476 ms (before: up to 501 ms), pan 84–819 ms (before 230–931 ms). Noisy.

Not fixed: cold first gestures still show 66–350 ms gaps. Their long frames are the still frame
at load (the exact path, up to 217 ms), the first tiled frame's overlay draw (about 22 ms), single
tiles whose plan takes up to 30 ms, and V8 scavenges of 30–58 ms. A single 256 px fallback block
can still cost up to 37 ms.

Also added: a frame counter `exact`, set when a frame was drawn on the exact path, so the time
to sharp after a gesture can be measured.
