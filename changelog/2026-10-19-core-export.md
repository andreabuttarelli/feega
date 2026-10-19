# Export through gpu-core, behind `?engine=gpu-core` / `?engine=gpu-core-gl`

With the flag, the editor's export renders offline through the core instead of capturing the
HTML engine: for each frame time, `drawFrame` → media seeked to the exact source time and awaited
→ core draw → bitmap → the same encoder (`core-export.ts`, called from `MotionPreview.render`).
No timers, no paint settling: frames are a pure function of the doc.

It is all or nothing. If any frame has something the display list does not draw
(`coreExportable`), or the core reports a skipped item on a frame, the whole export goes back to
the HTML engine, so one file never mixes two renderers.

Parity of the core export against the current export capture (WebGPU, 6 frames):

| Kind | SSIM |
|---|---|
| shapes | 0.9992 |
| images | 0.9979 |
| video | 1.0000 |
| masks | 0.9981 |
| effects | 0.9971 |
| transitions | 0.9974 |
| backdrop | 0.9984 |
| noise | 0.9959 |

Determinism: two exports of the same doc produced byte-identical frames (video, noise, masks).
Next, for a native export: depend on `packages/gpu-text` in the core so text renders without JS.
