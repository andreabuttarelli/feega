# Shader effects in the motion engine (open-source `shaders`)

**Why.** Backdrops, materials, light and reveals that CSS and our WebGL effects could not reach.
The `shaders` library (Shader Effects Inc., <https://github.com/shader-effects-inc/shaders>,
npm `shaders` 4.0.4, **MIT**) brings 200+ WebGPU effects. Only the MIT package is used: no Pro
presets, no Pro assets (separate paid licence). Attribution: `shaders 4.0.4, Copyright (c) 2026
Shader Effects Inc., MIT licence`, shipped in the hosted bundle and its `LICENSE`. Its dependency
`tsover-runtime` is Apache-2.0, the rest MIT.

**Determinism, verified before wiring.** The library has no `time` prop; its clock is internal.
The core renderer (`shaderRendererGPU`) has a frame-locked mode: `setFrameLocked(true)` zeroes
the clocks, `renderSyntheticFrame(delta, { waitForGpu: false })` advances them by `delta` and
draws synchronously. The adapter (`shader-effects/adapter.ts`) seeks by re-locking (zero) and
rendering `delta = t`: a frame is a function of `t` alone, in any seek order. `observeElement:
false` and `beginRecordingResolution(w, h, 1)` remove the ResizeObserver and the DPR: the
observer resized the canvas to its parent after the first frame and changed every pixel. The
WebGPU canvas stays out of the DOM; each seek copies it into the layer's 2D canvas in the same
task (WebGPU drawing buffers expire at the end of the task), so capture lanes and the compositor
see a plain 2D canvas and nothing changed there. A second copy on the next animation frame covers
WebKit, whose drawImage of a WebGPU canvas is stale within the same rendering opportunity.
Probe: seeks `[1, 3, 0.5, 1, 3, 2.25, 0.5]` give identical hashes for the same `t`, headless and
headed Chromium and WebKit (Playwright 1.63); Chromium and WebKit agree within 1 LSB.

**Kept static.** `speed` drives the library's integrated time (`Σ speed·dt`): keyframing it would
make the frame depend on the path. It is a clip prop without keyframes. Effects with frame-to-frame
state (trails, fluid sims, particles) are not in the catalogue.

**What exists.**
- `ShaderEffect` clip, 24 curated effects (`shader-effects/catalogue.ts`): gradients, noise,
  glass, metal, light, distortions, wipes, blurs, plus two cursor effects that move only in live
  embeds. Filters apply to an image asset, or a mesh gradient without one. Wipes: progress 1→0
  reveals.
- `add_shader_effect` agent tool; knobs validated against the catalogue in the component schema.
- Custom components: `shaders.layer(canvas, effect, values, image)` follows `tl` by itself and
  registers its readiness in `__hf.buildReady`; lint keeps cursor effects to live components.
- Self-hosted `/motion-libs/shaders@4.0.4/shaders.iife.js` (2.5 MB, loaded only when used), built
  from `shader-effects/library-entry.ts` through the new `entry` field of a hosted lib.
- `GET /api/v1/motion/shader-effects`, `feega motion shaders`, MCP `list_shader_effects`.
- Guide `shader-effects` (when, time, performance, brand logos untouched).
- `bench:export --headed`.

**Budget.** WebGPU devices are not WebGL contexts: `feega-webgl` stays 0 for these clips. One
shared device per page (`createSharedDevice`).

**Fallback.** Without WebGPU (Firefox, older Safari, Playwright 1.60 WebKit) the layer paints a
static linear gradient of its colours.

**Measured (export bench, 4 s at 1080p, 4 lanes, headed).** Chromium 18–35 ms/frame wall,
preview/export parity mean 0.000. WebKit 39–40 ms/frame, parity 0.000; blacks a little lifted
against Chromium.

**Discarded.** `createRendererFromJSON`: no uniform updates without re-registering nodes, which
resets their clocks. `createShader` (js): its own rAF loop. Copy-to-buffer readback: slower, and
stale on WebKit too.
