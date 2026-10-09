# Particles off the canvas are not drawn

After the glow sheet (#335) the asteroids embed spent ~24 ms of a ~50 ms frame (Chromium 4×
CPU) in `drawImage`, one per particle. Box emitters wider than the frame (the starfield is
1.25 × 1.39 of it) keep a large share of their particles outside the canvas, and each still
cost a draw call.

- `drawParticles` skips a particle whose extent (size × streak length, the widest shape) lies
  wholly outside the canvas.
- Glow slots on the sheet are now spaced by their own size instead of 2 px, so a heavily
  shrunk glow cannot sample its neighbour.
- Measured: asteroids median ~52 → ~43 ms, p95 ~66 → ~58 ms (two runs each).
- Frame diff vs #335: ≤ 100 pixels of 2 M differ (max 66/255), mean 0.0001. Culling is exact
  in geometry; the residue follows the order glows land on the sheet (culled colours never get
  a slot), not the culled dots themselves. Kept as a known, invisible difference.
- Also restores the repo formatting of the particle files, which #335 had rewritten with
  prettier defaults.
