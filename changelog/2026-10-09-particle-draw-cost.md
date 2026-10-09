# Particles draw from a glow sheet

Profiling the asteroids doc in the embed (iPhone viewport) put almost all frame time in
`drawParticles`: each soft circle built its own `createRadialGradient` with three
`addColorStop`, wrapped in `save`/`translate`/`rotate`/`restore`. Two starfield emitters keep
~3,600 dots alive. WebKit paints radial gradients on the CPU: 780 ms a frame.

- Soft glows are painted once into a shared sheet (2048² canvas, shelf-packed, one slot per
  rounded colour × softness × power-of-two size) owned by the runtime and kept across frames;
  each particle is one `drawImage` from it. One sheet = one texture, which matters: a canvas per
  glow made Chromium slower than the gradients.
- Other shapes: `setTransform` per particle instead of `save`/`restore`; `globalAlpha` written
  only when it changes.
- Same code paints export frames. Frame diff before/after (5 frames, 1920×1080): mean 0.03/255,
  ~7k pixels over 8/255 at dot edges (bilinear sampling of the glow vs analytic coverage); same
  dots, same places, indistinguishable at 1:1.
- Measured (embed, iPhone 13 viewport, 10 s): Chromium 4× CPU median 146 → 53 ms; WebKit
  785 → 17 ms. Numbers in `~/Documents/feega-videos/cpu-perf/results.md`.
- Discarded: per-frame gradient cache only (Chromium 66 ms, WebKit unchanged); a canvas per
  glow (Chromium 220 ms: texture switching).
