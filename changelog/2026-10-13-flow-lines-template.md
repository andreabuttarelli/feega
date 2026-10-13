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

## Individual strands (rebuild after review)

The LIC look let the underlying shapes show (ribbons were bands of the stream function). Now
up to 56k seeded strands, each integrated through the field in the vertex shader (RK2, 56
points, instanced thin quads, additive). Each strand grows from its head, holds, retracts its
tail and fades on its own staggered phase (`fract(offset + speed·t/L)`), so lines appear and
disappear independently. Brightness comes only from strand density; the round feathered mass
comes from the seed distribution, not a mask. Field calmer and scaled to the mass.

- Strand quads face either way, so the material is `DoubleSide`: with back-face culling
  almost every strand vanished.
- Field target is RGBA8 holding the unit direction, read with `textureLod` in the vertex shader.
- ~0.2 s/frame at 1080×1920 on Apple Metal; very slow on software GL, so the library preview
  is cut from a GPU render (same 48 frames at 12 fps) instead of `scripts/component-previews.ts`.
