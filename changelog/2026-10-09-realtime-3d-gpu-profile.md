# Realtime 3D: one GPU profile per target

Every WebGL renderer the engine made (Shape3D/Model3D/Text3D/Logo3D/Device3D, Composition cards)
used the export settings everywhere: DPR 1 at output resolution, antialias on. On a phone that
means a 1920 px buffer behind a 390 px wide preview.

- `gpu.ts`: `GPU_GLOBAL.renderer(THREE, canvas, extra, Scaling)` creates the renderer from a
  profile table keyed on `Target`. `VIDEO_GPU` reproduces the old options exactly (tested).
  `SCREEN_GPU`: resolution capped to the screen at DPR 1.5 (1.25 on coarse pointers), antialias
  off on coarse pointers, `powerPreference: 'high-performance'`, and an adaptive scale
  (`paced`): 20 frames over 19 ms step down ×0.8 (floor 0.4), 120 frames under 12 ms step back up
  to the session cap. Only frames that actually rendered count, so a paused preview never resizes.
- Bokeh (DOF) renderers are `Scaling.Fixed`: their blur is in pixels.
- `keptRenderer` keys reuse on the logical canvas size, not the scaled buffer.
- Custom components get `three.renderer(canvas)`; prompt and `write_component` carry a short
  perf checklist (`THREE_GUIDANCE`).

Measured (Saturn, asteroids; iPhone 13 viewport, Chromium 4× CPU, WebKit): no frame-time change.
Both are CPU-bound in headless (asteroids ~140 ms/frame under throttle from DOM/particles, not GL);
Saturn already runs at vsync. Table in `~/Documents/feega-videos/realtime-3d/results.md`.

Discarded: WebGPURenderer. Self-hosted three is 0.181.2 without the `three/webgpu` build, and
every engine and user shader is GLSL `ShaderMaterial`, which WebGPURenderer does not run (TSL
only). Static shadow maps and `matrixAutoUpdate=false` in built-ins: built-ins only render on
seek and move every frame while playing, so nothing to save.
