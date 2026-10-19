# gpu-core draws pictures and video frames

Images, logos and video frames are drawn by the Rust core (ADR 0019). The display list's image
item (fit, focus, zoom, `clipped`, `inner`) is placed by `pictures::image_rect`, the same rule as
`gpu-full/image-rect.ts`, and filled as an image brush clipped to the box (or spilling past it
for logos). Pixels reach the core through a host port: `Pictures`, clip id to image data.

- Web: `core-web.ts` hands each picture's source (image element or the video seeked to its source
  time by `media.ts`) to `WebCore.picture`, which copies it into a registered GPU texture with
  `copyExternalImageToTexture` — no CPU readback. Still images upload once, video every frame.
- Native: the render binary decodes `src` as a PNG path.

Parity on WebGPU (Chromium, Metal), 6 frames, both backends vs the HTML engine:

| Kind | TS WebGL2 SSIM | core SSIM |
|---|---|---|
| images (cover, contain, logo) | 0.9978 | 0.9979 |
| zoom (Ken Burns + rotation) | 0.9994 | 0.9994 |
| moves (drift, zoom, pan) | 0.9978 | 0.9981 |
| video | 0.9622 | 0.9608 |

Video sits at 0.96 on both backends: the gap is the HTML reference's frame timing, not the core.
Not done: corner radius on pictures (the display list carries none yet), and the native parity
script still runs without assets.
