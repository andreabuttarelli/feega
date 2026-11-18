# Zoom look-ahead no longer walks millions of tiles

On the user's canvas a fast wheel zoom froze the page inside `webcore_frame`,
on dev before and after #2206 and #2205. Paused stacks (agent a0d3) all sat in
`Tiles::ahead` → `Tiles::frame` → `keys_over`.

`ahead` predicts the camera six frames on as `zoom * ratio^6`. Zooming out fast,
that is close to zero, so the predicted world is enormous, while `step_for`
clamps the step to the canvas floor and keeps tiles small. `frame` enumerated
every tile of that world and only then dropped the ones off the canvas.

Three guards in `tiles.rs`:
- `frame` walks only the part of the world on the canvas (`on_canvas`);
- a view over `FRAME_TILES_MAX` tiles yields an empty frame;
- the prediction stays within `AHEAD_ZOOM_REACH` (2×) of the current zoom.

Test: `looking_ahead_of_a_fast_zoom_out_ends_in_time` (hung before, 2 s
timeout). On the canvas copy, headed WebGPU: dev froze on the extreme pinch
(0.3↔2.4); the fix finished it and the moderate one (0.5↔1.5) alive.
