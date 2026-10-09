# Rotated and skewed layers composited on the GPU in export

Step 5 of the GPU compositing plan, the one that lets real docs take the GPU path: the asteroid
doc rotates every sphere and the particle field, and a rotated canvas used to send its layer to
html-to-image every frame (with `toDataURL` of the canvas).

- Canvases, fills, clips and masks are drawn as quads through their full affine; only the
  filters care about the transform, and `filtersFit` (one table, `layer-tree.ts`) says which:
  grain under any flat affine (its noise follows the layer), blur under rotation or uniform
  scale, the glass lens only upright.
- Quad edges are antialiased in the paint shader (coverage from the distance to the edge, quad
  grown by one pixel), as the 2D canvas did for upright layers.

Parity, flat vs gpu: asteroids Chromium 39–41 dB, WebKit 39–43 dB; the diff maps show grain
noise only (Chromium's feTurbulence; WebKit's own blur offset, see the blur step), no layer
moved or missing. Glass fixture (rotated): Chromium 39–41 dB; WebKit vs live player 29–38 dB
(SSIM 0.98) where the old export scored 15 dB. Saturn identical.

Speed, ms/frame (1 lane / 4 lanes), baseline → now: asteroids Chromium 632 → 65 / 624 → 127,
WebKit 2300 → 580 (one lane, as Safari exports); glass fixture Chromium 654 → 94, WebKit 3913 →
765.
