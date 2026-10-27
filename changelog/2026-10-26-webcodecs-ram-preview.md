# WebCodecs video decode and RAM preview

Video clips were read through a `<video>` element: one seek per drawn frame, `seeked` events as the clock, nothing kept. `createMedia` (the one place the canvas, the editor player and the core export get their pictures) now takes a `VideoFrames` port. The adapter (`src/lib/motion/gpu/webcodecs-decoder.ts`) is mediabunny's `CanvasSink` on WebCodecs; the pool, the LRU frame cache with a byte budget and the per-source request lane live in `packages/motion-core/src/motion/gpu-full/` and know nothing of the browser API, so they are tested with a fake decoder. No WebCodecs, or a codec it cannot decode: `frames.at` answers null and the old `<video>` path runs.

Decisions:
- Frames are `ImageBitmap`s, not canvases. The core raster treats a canvas as "moving" and re-uploads it every draw; a bitmap is uploaded once per frame.
- Decode width follows the drawn size (`item.size.width`), so a 4K clip in a 1080p frame costs 1080p of memory.
- Cache lookup and decoder seeks are nudged by 1e-6 / 1e-4 s: `frame / fps` lands on a frame boundary within one ulp and picked the previous frame.
- RAM preview caches decoded video frames of a range, not composited pixels. The canvas draws all frames in one raster, so a composited cache had no single surface to hold; the decode is the expensive part anyway. `⌥↵` or the timeline button runs `CoreFrames.cache`; the green line under the ruler is `ram.runs`.

Measured on a 4K H.264 30 fps clip at 1920 px, Chrome: cold seek 49 ms median (was 56), live 5 s play drops 56 of 150 frames (was 57), cached seek 0 ms, play after RAM preview 0 dropped. Live 4K decode is decoder-bound either way. Next slice: proxies (low-res transcode on upload) for live playback, then prefetch ahead of the playhead.
