# gpu-full draws images, video and logos

Step 1 of the gpu-full roadmap (ADR 0019). `Image`, `Video` and `Logo` become `ImageItem`s in
the display list: box, fit, focus, zoom, and for video the source time from `sourceSeconds`
(speed, reverse, trim, time remap). `imageRect` reproduces CSS `object-fit`/`object-position`
and the zoom around the focus; a logo spans its box width at the picture's aspect, centred, as
the HTML `<img>` in an auto-height box does. `media.ts` loads pictures and seeks one video
element per clip before a frame is drawn. A Logo with no picture (brand name as text) is named
unsupported.

Harness: video assets are served as mp4 with byte ranges; kinds `images`, `zoom`, `video`.

| Kind | mean SSIM | worst | pixels off |
|---|---|---|---|
| images (cover, contain, logo) | 0.9978 | 0.9978 | 0.30% |
| zoom (keyframed zoom + rotation) | 0.9994 | 0.9993 | ≤0.27% |
| video (speed 1.5) | 0.9622 | 0.9601 | ≤4.9% — about one source frame apart from the HTML player's seek |
