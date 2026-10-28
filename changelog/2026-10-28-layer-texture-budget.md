# Layer textures under the device budget

The crash record from #1506 (iPhone, "Ledgerline mockups", zoom 0.17) showed 215 MB in 268
live WebGPU textures with `cacheBytes = 0`: the memory was not the zoom raster cache.

Cause: `FilterPasses` pooled layer/filter textures up to 48 sizes × 6 each, keyed by exact
pixel size. Layer regions scale with zoom, so a fast zoom makes a new size every frame and the
pool fills with ~0.8 MB textures it never reuses. Replaying a 60-frame zoom-out over three tall
frames on the old policy: 5400 textures created, pool peak 228 MB. The layer cache (32 entries,
240 frames) had no byte cap either.

Now:
- `texture_budget::Shelves` caps the pool by bytes, dropping the oldest shelved texture first.
- The layer cache drops least-recently-used entries over its byte cap.
- `WebCore::set_budget` splits the device budget (phone 128 MB): six screen-sized textures off
  the top, then pool 1/8, layer cache 1/8, raster cache the rest. Phone at 780×1688: pool 12 MB,
  layers 12 MB, cache 72 MB. Same scenario: pool peak ≤ 12 MB.

Probe fixes: `canvas` is read from the drawing buffer every tick (it was the area at mount,
0×0); `wasmBytes` comes from the memory wasm-bindgen's init returns (the probe missed loads
made before it was installed); new `scratchBytes` reports pool + layer cache + spare rasters.

Not done: rounding layer sizes into buckets for reuse (changes layer placement), one texture
per frame below a zoom threshold. Zoom sharpening is untouched.
