# Canvas: the core counts what each frame does

The canvas misses its frame budget (90–120 fps asked, 11–27 fps measured on the zoom bench at
CPU 4x) and no number said which part of a frame spent it: months of levers were tuned against
fps alone.

Each core frame now reports how many display-list plans it built and how many world uses each one
walked, how many rasters it baked and their time, and the picture bytes uploaded since the last
frame (`WebCore::frame_counts`, read by `CoreFrames` into `window.__gpuCanvas.frames`). The
benches summarise them for camera frames — the frames where only the camera moved — next to p99
and the frames over 11 ms. `scripts/perf/profile-buckets.mjs` splits a CPU profile from the
landings bench into plan, raster, present, JS, GC and native time.

These are the numbers the renderer restructure is held to: a camera frame should plan nothing,
bake nothing and upload within a fixed budget. Today it does all three, so the counters only
report; the blocking gate in the `zoom` CI job lands with the change that turns them to zero.
