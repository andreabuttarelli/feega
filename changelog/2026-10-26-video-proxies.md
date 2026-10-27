# Video proxies for live playback

Live 4K decode is decoder-bound (see the WebCodecs entry): 57 of 150 frames dropped in a 5 s play. A proxy removes the work instead of speeding it up.

What changed:
- `registerUploadedAsset` (the one place every upload and import passes) starts `createVideoProxy` in the background for a video. It downloads the original, probes the size with ffmpeg, and only if the short side is at least 1440 px writes `<path>.proxy.mp4` (H.264, 960 px long edge, `-g 15`, CRF 28) in `canvas-assets` and records it in `assets.proxy_url` (migration `20261026120000`). It also fills `width`/`height`.
- `GET /p/:p/c/:c/assets/:id?proxy=1` signs the proxy when there is one and the original otherwise. No other route changed.
- `sharedFrames()` (canvas, editor player) wraps the decoder in `proxying`, which rewrites a canvas asset src to `?proxy=1` while `proxySetting` is on. The cache keys on the rewritten src, so toggling never serves frames of the other tier. `originalFrames()` is a separate decoder for `core-export`: export never sees a proxy.
- Timeline bar: **Use proxies**, on by default, per session.

Discarded: transcoding at upload in the browser (slow, blocks the user); a proxy for every video (a 1080p file decodes fine); reusing the farm worker (uploads do not go through it).

Not covered: videos uploaded before this change have no proxy and play from the original; no backfill. The HTML `<video>` fallback path keeps the original.

Bench (`scripts/bench/video-decode.ts`, 4K H.264 30 fps 10 s clip, Chrome): live 5 s play dropped 57 of 150 frames from the original, 0 from the proxy; cold seek median 53 ms vs 6.5 ms.
