# Flow lines template

Generative template from reference `refs-batch5/2-flow-lines`: fine white hair-like streamlines
on black, swirling round a few vortices, bright ribbons and dark gaps, round feathered mass.

- GPU, one shared renderer (`three.renderer`), two passes per frame: a curl-noise field
  (4D simplex, potential + `r²` hold term that keeps the mass round) into a half-float target,
  then line-integral convolution over a seeded hash-noise texture. Ribbons are bands of the
  stream function, so they always follow the lines.
- Every frame is a pure function of `t`: no ping-pong buffers, no particles carried between
  frames. The field walks a circle in noise space (seamless loop); a periodic LIC kernel
  slides along the lines a whole number of passes per loop (`speed`). Returns `{ still(t) }`.
- Title is its own beat: the lines dim (`titleDim`) while it holds, then come back.
- Discarded: instanced streamlines integrated per vertex (O(n²) per line) and advected
  particles with trails (not deterministic per seek).
- Cost: ~0.23 s/frame at 1080×1920 on Apple Metal; on a software-GL headless Chromium
  (render farm args) ~20 s/frame at that size.
