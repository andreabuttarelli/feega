# Live frames show 2× snapshots on the canvas

Measured (`~/Documents/feega-videos/perf/always-live/`): 20 always-live
frames cost ~0.9 GB and drop zoom to ~15 fps under 4× CPU throttle.

- `live-budget.ts` is now one table, frame state → mode: idle → snapshot,
  editing → live, playing → live. The old "three largest visible frames are
  live" budget is gone; so is an intermediate design (visible at zoom ≥ 0.5,
  LRU cap of 6), dropped for the simpler rule.
- Editing = double-click on the frame (`editingLive` in `GpuFlow`), cleared
  when the frame leaves the selection.
- The iframe is mounted only while live and unmounted after, so memory
  returns. The poster stays on top until the iframe has painted.
- Posters are captured at `deviceScaleFactor` 2 (`POSTER_SCALE`).
- Posters are retaken on Vite HMR (`dev-hmr.ts`, websocket with the client's
  `wsToken`) when the camera is still. Non-Vite dev servers get no refresh.
- `feegaSource()` now injects in `load`: placed after `sveltekit()` its
  `transform` got compiled JS and every route answered 500.
