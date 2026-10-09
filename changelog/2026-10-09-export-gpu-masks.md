# Masks composited on the GPU in export

Step 2 of the GPU compositing plan. Before, a CSS mask (`.km`/`.kt`, frozen to SVG pictures by
`freezeMasks`) sent its whole layer to html-to-image every frame, canvases included (the
asteroids' three.js spheres).

- The layer walker reads the frozen mask pictures and their `mask-composite`
  (`cssMasks`, standard and WebKit names), rasterises each picture once per size and URL, and
  the compositor builds the coverage bottom layer first (add, subtract, intersect, exclude) and
  multiplies the layer by it, after its filters, as CSS does.
- Static sheets (mask pictures, cached DOM rasters) are cropped to their visible pixels once:
  full-frame transparent textures were most of the upload.
- Every isolated pass (clear, filter, mask, blend) is scissored to the layer's bounds.

Parity (asteroids with masks, rotations removed; flat vs gpu): WebKit PSNR 45–48 dB, Chromium
38–40 dB — the difference is grain noise only (Chromium's feTurbulence), mask edges match.
Speed on that doc, 1 lane: Chromium 539 → 76 ms/frame, WebKit 2304 → 746. Saturn, asteroids
and the glass fixture unchanged (they need rotations and glass: steps 4–5).

In WebKit about 450 ms of what is left is the particle layer's 2D drawing, paid when its
bitmap is first read.
