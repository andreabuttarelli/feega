# Moving rasters posed on the GPU, stable raster keys

Step 7 of the GPU compositing plan: layers that only move should not go back to html-to-image.

- **Stable keys.** Neutralising a raster's path (`neutralised`, now in `raster-key.ts` with
  `pathStyles`) rewrote the `style` attribute in the browser's serialisation, so every raster
  missed the cache on the second frame (~1 s in WebKit on the blurred shapes). Keys now read
  `el.style.cssText`.
- **Glass body.** The liquid glass chrome moves and squashes through its body group's
  `transform`; it is marked `data-pose` (`POSE_ATTR`). The capture rasters it at a resting pose
  (`restingPose`: frame centre, scale rounded up to a quarter so small squashes share a raster)
  and the compositor applies `CTM(now) · CTM(rest)⁻¹` and the group opacity.
- **HTML rasters.** A single-element raster whose own CSS transform or opacity animates (a title
  line sliding in) is rastered with `transform: none; opacity: 1` and posed the same way, when its
  rest box lies inside the frame. Ancestor clips are GPU node clips, so a line mask still cuts it.
- Discarded: keeping sheets on the GPU between frames (lane-held textures, only new sheets sent).
  A/B showed no gain: the time is the WebKit readback of the live three.js canvases, not the
  static sheets.

Parity: glass posed vs re-rastered 56–64 dB; title mid-entrance posed vs re-rastered 58–59 dB.
Speed (3 interleaved A/B runs vs before #361, ms/frame): asteroids WebKit 1 lane 689 → 464,
glass fixture WebKit 800 → 698, Chromium 4 lanes 195 → 152 (glass), 138 → 127 (asteroids).
Full length (465 f): asteroids WebKit 407 ms/frame (189 s, was 253 s), glass WebKit 588 (273 s,
was 288 s), Chromium 4 lanes 37 / 39 ms/frame.

Found, not fixed: Chromium 4 lanes lose one lane's three.js canvases (16 WebGL contexts per
page), every 4th frame without its 3D layer — before this change too. See LESSONS.md.
