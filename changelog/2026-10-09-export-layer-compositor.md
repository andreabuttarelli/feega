# Export frames composited on the GPU, one shared WebGL2 context

Step 1 of the GPU compositing plan (blur, flat glass and masks off the html-to-image path).

Before: a frame was either one html-to-image pass of the whole page, or the "split" plan
(`layer-plan.ts`): root layers that were bare canvases drawn on a 2D canvas, the rest in up to
two DOM passes. Anything else in a layer (a filter, a rotation, a mask) sent the whole layer
back to html-to-image, every frame.

Now, with `Layering.Gpu` (what the export asks for when the page has WebGL2):

- The capture runtime walks each layer into a tree (`layer-tree.ts`): fills, canvases with
  their affine, opacity, blend, overflow clips, grain filters. What it can't describe stays
  DOM and is rasterised with html-to-image, neighbours joined in one pass, ancestors'
  effects switched off (the GPU applies them), and the raster reused while its markup is
  unchanged.
- The host composites the tree bottom-up (`export/compositor.ts`, plan; `webgl-device.ts`,
  WebGL2) in ONE context for the whole export page, never one per lane: Safari's context
  limit dropped three.js layers when each lane had its own (#337/#350).
- Grain runs as a shader with the same math and tile as the CPU pass.
- The tree is used only when it saves work: it carries a GPU-only effect, and at most two
  rasters change this frame. Otherwise the old split/flat path runs, unchanged.

Parity (24 frames, flat vs gpu): Saturn, asteroids, glass+blur fixture identical (they fall
back: their layers are masked, rotated or under glass, which later steps lift). Asteroids with
masks and rotations removed: WebKit PSNR 45–47 dB (as the CPU grain pass), Chromium 37–45 dB
(Chromium's own feTurbulence differs from the spec noise; same grain size and contrast).
Speed on that doc, 1 lane: Chromium 439 → 248 ms/frame, WebKit 2750 → 2216.
