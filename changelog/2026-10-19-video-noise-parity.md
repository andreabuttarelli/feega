# Video and grain parity: two reference bugs, one core bug

Video sat at SSIM 0.96 and noise at 0.93 on both GPU backends. Measured, not guessed:

- **Export stretched cover videos.** The capture library (html-to-image 1.11.13) copies a video
  frame at the element's size before `object-fit` applies, so a `cover` clip came out stretched
  in every export, while the live player cropped it. Patched with patch-package
  (`patches/html-to-image+1.11.13.patch`): the frame is copied at the video's own size and the
  copied `object-fit` crops it. Video parity 0.9622 → 1.0000 on both backends.
- **Frame timing was not the gap.** A test video whose luma encodes the frame number showed the
  HTML reference and the TS backend on the same decoded frame at all 12 sampled times.
- **The core's video colours were off.** WebGPU `copyExternalImageToTexture` from a video element
  converts YUV differently from a 2D canvas (up to ±8 luma). Video frames now go through a 2D
  canvas before the upload, like the TS backend; the frame-number luma then matches exactly.
- **Grain was sampled half a pixel early.** The browser's `feTurbulence`, and the capture's own
  grain (`GRAIN_SAMPLE_OFFSET = 1`), evaluate noise at pixel index + 1, not at the pixel centre.
  Shifting by ½ px (core shader, TS `TURBULENCE_CENTER`) takes noise from 0.93 to 0.9962 (core)
  and 0.9910 (TS). Evaluating the noise in the item's local space instead made it worse (0.82):
  the browser evaluates it in frame space.

Left: the wave effect's displacement is nearest-sampled by the browser and bilinear here.
