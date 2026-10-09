# Particles draw without a gradient per dot

Profiling the asteroids doc in the embed (iPhone viewport, Chromium 4× CPU throttle) put
~60 ms of every ~125 ms frame inside `drawParticles`: each soft circle built its own
`createRadialGradient` with three `addColorStop`, wrapped in `save`/`translate`/`rotate`/`restore`.
Two starfield emitters keep ~3,600 dots alive.

- Soft circles share one unit-radius gradient per colour and softness within a frame; the
  particle's transform scales it. Colours are already rounded to integers, so a slow
  start→end blend yields a few dozen gradients, not thousands.
- `setTransform` per particle replaces `save`/`restore`; the drawing ends on identity and
  `globalAlpha = 1`.
- Same code paints export frames. Frame diff before/after (5 frames, 1920×1080): max 6/255 on
  antialiased edges, mean 0.
- Measured: asteroids embed median 124 → 80 ms, p95 158 → 102 ms. Numbers in
  `~/Documents/feega-videos/cpu-perf/results.md`.
- Discarded: a cached sprite per colour via `drawImage` — larger resampling diff and a cache
  that must outlive the function, which is serialized with `toString()`.
