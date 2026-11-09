# Tiled canvas: no tile-by-tile refresh

User feedback with `?coreTiles`: motion is fluid but content visibly refreshes tile by tile.
Now:
- a zoom step is shown only once it covers the whole screen (`Tiles::frame` picks the sharpest
  complete step, finer steps within 2x first); partial steps are never drawn;
- during a gesture only tiles with nothing within 2x sharpness (`NEAR_STEPS`) are rastered;
- at rest the exact blocks appear together, once all are rastered; no current-step refresh first;
- while idle, a ring around the view and the next sharper step are fetched ahead.

Bench: swaps (screen changes >0.1 % in the 2 s after a gesture, sampled every 150 ms). A/B
landings, CPU 1x, 5 interleaved, flag on: pan 2→1, zoom 3→1–2, fit 0→0. Cost: zoom 56→53 fps,
p95 18.8→33 ms (bursts when a whole screen crosses the 2x line). Rastering hidden tiles during
the gesture instead was worse (45 fps). Profile: vello per-render `createBindGroup`/`createBuffer`
still dominate. Not done: crossfade.
