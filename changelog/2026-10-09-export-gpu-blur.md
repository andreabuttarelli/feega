# Gaussian blur composited on the GPU in export

Step 3 of the GPU compositing plan. Before, a blurred element (CSS `blur()` or the Gaussian
blur effect's `feGaussianBlur` filter) sent its layer to html-to-image with the filter on, and
WebKit painted the filter in software.

- `cssFilters` reads a layer's filter chain in order: grain filters, `blur(Npx)`, and SVG
  filters made of one `feGaussianBlur` on `SourceGraphic`. Anything else stays DOM.
- The compositor runs a separable Gaussian (two passes, radius 3σ) on the layer's own surface;
  σ follows the element's scale. A skewed or non-uniformly scaled blur stays DOM.
- Blur reaches past the frame: the tree carries a `pad` (3σ, at most 384 px), surfaces are that
  much larger on every side, and DOM rasters are taken with the root shifted by the pad, so
  content just off-frame still bleeds in as it does in the browser.

Parity (asteroids with masks, rotations removed): Chromium 38–40 dB, and along the blurred band
the pixels match within 1 level. WebKit 39–41 dB: WebKit's own rendering (live preview and
html-to-image) moves an element filtered by a `userSpaceOnUse` SVG filter by the filter
region's x/y (≈ 110, 66 px for the band); the GPU export draws it where Chromium does.
`bench:export --parity --live` now also saves a screenshot of the live player per frame, to
tell a capture difference from an engine difference.
