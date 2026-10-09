# Export draws canvas layers directly

Before: every export frame went through html-to-image. Each `<canvas>` (three.js, custom
components, particles, WebGL blobs) became a PNG data URL, nested as `<img>` in an SVG
`foreignObject`, then decoded again when the SVG was painted.

Now `captureRuntime` looks at the top-level layers of `#root`. A layer whose visible content
is only canvases, flat boxes (solid background, overflow clip) and upright transforms is drawn
with `drawImage` straight from the canvas; the rest still goes through html-to-image, split
into at most two SVG passes (below and above). Layer blend modes map to the 2D context's
`globalCompositeOperation`. `planLayers` (`layer-plan.ts`) decides; it keeps the old single
pass when there is no such layer, when a `backdrop-filter` or an unknown blend sits above it,
or when splitting would need more than two SVG passes (8 passes on the asteroid doc were
slower than one).

Measured with `npm run bench:export` (new, `scripts/bench/`), 1080p: a three.js Custom doc
goes from 284 to 15 ms/frame in Chromium and 272 to 24 in WebKit. Docs whose canvases sit
under SVG filters (grain) are unchanged until those filters move to the GPU.

`CaptureRequest.layering = flat` keeps the old path; `bench:export --parity` compares both
on the same frames (0 difference on the Saturn doc in Chromium and WebKit).
