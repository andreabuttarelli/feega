---
title: Video playback and RAM preview
description: How video clips decode while you scrub and play, and how to cache a range for full-speed playback.
sidebar:
  order: 2
---

## Frame-accurate decoding

Video clips decode with the browser's WebCodecs API. Scrubbing or playing asks for the exact frame at the playhead, not the nearest one a `<video>` element can seek to.

- Decoded frames are kept in memory, up to 1 GB. Going back to a frame you already saw costs nothing.
- Frames decode at the size the clip is drawn, not at the file's size. A 4K clip in a 1080p frame is held at about 1080p.
- Up to four videos keep a decoder open at once; the least recently used one is released.
- The same decoder serves the canvas, the editor preview and the exports.

If the browser has no WebCodecs, or cannot decode a file's codec, the clip falls back to a `<video>` element. Nothing is shown to you; playback is just less smooth.

## RAM preview

RAM preview decodes every video frame of a range ahead of time, so playing that range does no decoding.

1. Optionally set a work area with `I` and `O`. Without one, the whole frame is cached.
2. Press `⌥↵` or click the memory-chip button in the timeline bar.
3. A green line under the ruler grows over the frames that are ready. Play when it covers the range.

Notes:

- A frame counts as ready only when every video in it is cached.
- If the range does not fit in 1 GB, the oldest frames are dropped and the green line shrinks to what is kept. Use a shorter work area.
- Frames without a video are always ready. The cache holds decoded video only; text, shapes and effects are still drawn live.
- Starting another RAM preview stops the one in progress.

## Measured

4K H.264 clip, 30 fps, drawn at 1920 px wide, Chrome on an Apple Silicon Mac:

| | `<video>` element | WebCodecs |
|---|---|---|
| Seek to a random time, median | 56 ms | 49 ms |
| Seek to a random time, 95th percentile | 97 ms | 94 ms |
| Seek to a frame already cached | not cached | 0 ms |
| Playing 5 s live, frames dropped of 150 | 57 | 56 |
| Playing 5 s after RAM preview, frames dropped | not available | 0 |

Decoding a 4K file live is limited by the decoder in both cases. RAM preview is what makes it play at full speed.
