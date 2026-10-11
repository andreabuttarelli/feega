# Grain on 3D clips is painted by the 3D renderer

**Before.** The Noise effect on a 3D clip was an SVG filter (`feTurbulence` → `feTile` →
arithmetic) on the `.ef` wrapper around the WebGL canvas. Two defects on embed fd37d96f:

- **Retina Safari showed no asteroids.** WebKit drops an SVG filter whose region, in device
  pixels, is large and sits around transformed content (empirically: 150% region at 1440×900 DPR 2
  fails, 125% passes; any fixed region fails on a bigger Retina stage).
- **Jank.** The canvases change every frame, so each grain filter re-ran per frame over 150% of
  the stage. Chromium headed (Metal GPU) at 2640×554 DPR 2: 37 fps, p95 83 ms, 12 long tasks; on
  current dev (masks 25% bigger since #405) 18 fps.

**Now.** A 3D clip's leading run of non-keyframed Noise effects goes to the 3D runtime
(`ThreeClip.grains`, `three-grain.ts`). The runtime bakes a 256 px seamless noise tile per grain
(`grainTile`, the same tile size the SVG grain used, regenerated only when `evolve` changes the
seed) and adds/subtracts it in two blended passes weighted by destination alpha. A grain after
another effect, or a keyframed one, keeps the SVG filter (effects apply in order). The tile
reproduces the SVG grain's darkening (turbulence alpha premultiplies its gray). Lit rims stay
slightly brighter than with the SVG filter.

**Masks.** #405's fixed 25% wrapper margin made every animated mask re-rasterize 2.25× the
pixels. The wrapper now spans the frame plus the clip's placed box (rotation and scale
included): a clip inside the frame keeps a frame-sized wrapper, a clip past the edge spans
exactly its own box.

**Measured** (headed Playwright, this Mac, DPR 2, rAF in the composition frame, 240 frames):

| | Chromium 1440×900 | Chromium 2640×554 | WebKit 1440×900 | WebKit 2640×554 |
|---|---|---|---|---|
| production (main) | 60 fps, p95 17 | 37 fps, p95 83, 12 long tasks | 60 fps, asteroids missing | 60 fps, asteroids missing |
| dev before | — | 18 fps, p95 68 | — | — |
| this change | 60 fps, p95 19 | 60 fps, p95 19, 0 long tasks | 60 fps, all asteroids | 60 fps, all asteroids |

**Discarded.** Shrinking the SVG filter region (still fails on bigger Retina stages, no
speed-up); per-pixel Perlin in the shader (47 fps: four noise evaluations per pixel per pass on
five canvases).

**Also.** The loader warns in the console when one video id is mounted twice on a page.
