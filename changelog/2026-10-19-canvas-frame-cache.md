# Core canvas: `cache: true` on `use` items

Before: every draw re-expanded each group (4 landing frames × ~270 clips) — pan 31–45 fps, 200+ ms worst frame.

- `gpu-core` `Library::plan` rasters a cached `use` to a texture at its device scale and draws it as one image. Fresh while the scale ratio is in [0.8, 1.02]; past that the stale texture is drawn scaled while one group per draw re-rasters. A use with no texture yet waits a draw instead of expanding (expansion was the spike). Uses larger than the side limit (4096 WebGPU/native, screen size WebGL2) are expanded as before. `putGroup`/`dropGroup` invalidate; textures off screen are evicted. Same plan on WebGPU, WebGL2 and native.
- Cache textures are not re-marked dirty every render (vello re-copied every override into its atlas each frame).
- TS: `cached()` in `residency.ts` flags uses whose texture fits `CACHE_SHARE` of the texture budget; `drawScreen` returns `pending` so the pacer keeps rastering.
- CoreFrames keeps groups put until the frame leaves the canvas (residency drops freed no GPU memory and cost 40–90 ms re-puts) and puts unseen frames in idle time while the view is still.
- Bench: Y pan reverses like X (content left the screen after 0.6 s); reports cache KB and z4 / z0.1 screenshots.
- Rasters are chunked: a raster draws at most `items` of a group (48 WebGPU, 96 native, 16 WebGL2) over its partial texture (`cache:<g>#building`); the stale texture stays on screen until the last chunk lands. A 270-clip landing cost 70–99 ms in one WebKit frame.
- Cached frames within one screen of the viewport are loaded, put and rastered ahead; the core rasters an off-screen cached use but draws nothing for it.
- `putGroup` is incremental: `parts()` splits a group into 32-item parts, the first `put_group`, the rest `append_group`, one part per frame (a landing was 6 MB of JSON: 12–15 ms stringify + 26–31 ms wasm parse in one frame). A group is drawn only once all its parts are in.
- Group pictures are decoded and resized with `createImageBitmap` off the main thread and uploaded one per frame; a group is drawn once all its pictures are in. On WebKit a frame turning resident uploaded every picture in one paint (60–214 ms). WebGL2 `picture()` accepts `ImageBitmap`.
- `Engine` marks dirty only the pictures the list draws (not every upload on every render). The marking stays: atlas growth drops overrides (`tests/layers.rs`).
- Left: on WebKit, frame loads (`prepare` + `drawFrame`, 35–75 ms each) still land mid-pan.
