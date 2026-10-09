# Grain runs on the GPU when Safari exports

WebKit paints SVG filters on the CPU: on the asteroid doc (node fd37d96f, 8 grain filters)
grain was ~2/3 of a 4.3 s frame. Chromium paints the same filters on the GPU, so it barely
noticed.

Now, in WebKit only, a top-level layer whose single filtered element carries only grain
filters (the `noise` effect's exact primitive chain) is captured as its own SVG pass with the
filter switched off, and the grain is applied by a WebGL2 pass (`effects/grain-gl.ts`):

- `turbulence.ts` ports the spec `feTurbulence` (fractalNoise, stitched 256 px tile). It
  matches Chromium and WebKit within 1 level per channel; both browsers sample the noise one
  pixel further than the spec text reads (`GRAIN_SAMPLE_OFFSET`, measured).
- The shader does `feColorMatrix saturate 0`, the arithmetic composite and `in SourceAlpha`,
  in the element's own user space: three probe points give the affine map from output pixels
  back to it, so rotated/skewed layers grain like the browser does. The tile is sampled
  bilinearly, as the browser resamples a transformed filter result.
- Canvas-only layers (step 1) apply the same pass to their pixels, in every engine.

Conditions for a grain pass (else the old path): one filtered element, filter = grain only,
positioned, opacity 1 up to the layer, no masks/clip-path above it, 2D transforms, and
nothing else in the layer that paints.

Measured (`npm run bench:export`, 1080p): asteroids in WebKit 4.3 → 2.8 s/frame (1 lane),
4.9 → 2.7 (4 lanes). In Chromium the split passes cost more than the GPU filters they replace
(0.66 → 1.27 s/frame), so Chromium keeps the single pass. Parity vs the old path: mean
difference 0.4–1 levels, < 1 % pixels over 8 levels in WebKit; same grain pattern by eye.

Not done: blur and glass filters (glass needs the backdrop; blur on DOM layers needs the
layer rasterized first). The live preview still uses the SVG filters: it is the reference look.
What remains in WebKit is html-to-image turning each layer's canvas into a PNG.
