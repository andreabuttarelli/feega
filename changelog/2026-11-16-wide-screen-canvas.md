# Wide screens: render targets fit the device, pictures outlive held scenes

**Before.** At 2200×1100 @2 (4400 device px) the WebGL core asked vello_hybrid for
intermediate layers and atlas uploads wider than its 4096 default
(`IntermediateTexture(TooLarge 4100×1608)`, panic `TextureTooLarge 4713×1910`). The JS
treated each error as a lost GPU and reattached forever on the last backend. The WebGPU
core used the default 8192 device limit, and its held view (1.5× screen) overflows it on a
4K @2 display. Separately, `release` unregistered a picture while the direct path's held
scene still encoded its id: vello panicked with "invalid empty image".

**Now.**
- `screen_fit` caps the core's internal screen so every screen-sized target (screen,
  retained + overscan, held view) fits the device limit; camera and tile pixel ratio are
  scaled by the same factor, the browser upsamples the canvas. WebGPU first requests the
  adapter's real `max_texture_dimension_2d`, so 4K @2 stays unscaled on Macs. WebGL caps
  the screen at 3840 (atlas 4096 minus overscan) and lifts the layer limit to the GL max.
- `Engine` ref-counts the image ids each held scene encodes; a released picture or raster
  is retired and freed when the last held scene reading it drops. The layer cache never
  sweeps an entry a held scene reads.
- After `LOSSES_PER_BACKEND` losses on the last backend the canvas falls back instead of
  reattaching in a loop.

**Discarded.** Splitting screen targets into tiles: a larger change in code other agents
are editing (`tiles.rs`), for a cap that only bites past ~5400 px on WebGPU. Patching the
vendored vello to skip missing images: hides the bug and draws holes.

Probe: `tests/perf/wide-screen-probe.spec.ts`
(`BENCH_CASE=budget BENCH_SPEC=wide-screen-probe PROBE_VIEWPORT=2200x1100`).
