# Flat liquid glass composited on the GPU in export

Step 4 of the GPU compositing plan. The flat `LiquidGlass` is an SVG filter on a div that wraps
every layer below it (`glass.ts`: lens map → smoothing blur → displacement → frost → cut by
the map → merged over the source). Any doc with glass went through html-to-image whole, every
frame.

- `glassOf` recognises exactly that filter chain (ids and attributes as `glassAttrs` writes
  them, all primitives on one box) and reads its numbers each frame; the lens map PNG is a
  sheet, drawn into its rectangle like `feImage` with `preserveAspectRatio="none"`.
- The compositor runs it on the surface that holds everything below the glass — the reason
  the frame is built bottom-up: smooth the map (anisotropic Gaussian), displace (map
  unpremultiplied, bilinear source sample), frost, multiply by the map's alpha, draw over.
  The rim and highlights (`lgs-*` SVG) stay a DOM raster above it.
- Layer affines come from `offsetLeft/Top` + the element's own matrix when its offset parent is
  its parent; probes only otherwise, and a static element gets `position: relative` for the
  probe (absolute probes in a static element measured its positioned ancestor: the title
  vanished behind a misplaced clip).
- The tree is dropped (old path) only when more than two DOM rasters hold a canvas or video,
  which redraw every frame; the walk stops at the third.

Parity vs the live player (glass fixture without rotations): Chromium flat 30–40 dB, GPU 30–39
dB with higher SSIM (0.97–0.99 vs 0.91–0.97). WebKit flat **15–16 dB**: WebKit's html-to-image
draws everything under the lens ~120 px lower, so Safari exports with glass were wrong; GPU
29–37 dB, SSIM 0.98–0.99 (rest is grain noise).
Speed, 1 lane, glass fixture without rotations (old path → GPU): Chromium 590 → 91 ms/frame,
WebKit 3829 → 720. With rotations the doc still takes the old path until step 5.
