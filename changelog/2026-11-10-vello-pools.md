# Vello: pooled textures, cached bind groups

Vello's wgpu engine rebuilt every bind group each recording, destroyed freed textures and only
reused buffers of an exact size class. Now (vendored `wgpu_engine.rs`): buffers reuse the
best-fitting larger one per usage/name (max 2 per kind), freed textures go to a pool of 8 keyed on
size and format, bind groups are cached by layout and resources (cleared at 512, entries dropped
when a pooled resource is destroyed).

Risks checked: no vello shader reads `arrayLength`, so a larger bound buffer is safe. Reused
textures that are not fully rewritten (the image atlas) are zeroed on reuse; uploaded images
(gradient ramps) overwrite the whole extent and skip it.

A/B, landings fixture, same app build with only the wasm swapped, Chromium headed:
- per frame while panning: createBindGroup 12.7→1.6 (tiles off), ~39→~7 (tiles on);
  createTexture roughly halved; createBuffer unchanged.
- gesture bench, tiles on, CPU 4x, 3 interleaved: zoom 12-13→14-18 fps, p95 167-182→118-134 ms;
  fit 27-33→34-39 fps, p95 83-102→67-68 ms; drag p95 99-100→85-100 ms; pan unchanged.
- load bench (tiles 0/1, CPU 1x/4x, 3 interleaved): within noise.
- `WebCore.frame` JS time unchanged (GPU work is async); pixels identical (max channel diff 1).
