# Tall frames export as images

Export of a 2542×10628 frame (an imported page) failed with a bare "Export failed".

- `chromiumExport` set the viewport to the whole frame and took one screenshot. Measured in local
  Chrome: at 2× (21256 device px) the picture wraps past 16384 px (repeated content) and WebP
  comes back as 0 bytes; on the serverless Chromium (SwiftShader) a viewport that tall is the
  failure the user saw. The still path already drew in 2048 px bands; the export path now uses
  the same banded `pictureOf`, cropping to the element box when there is one, and stitches with
  sharp.
- WebP is capped at 16383 px per side (JPG 65535): `rowSize` scales the row down to fit and
  `sizeNote` puts the reason in the export's "left out" note, pointing at PNG.
- The canvas dropped the action's error message; `exportFailure` now shows it, and a 5xx without
  one suggests a smaller size.

Not done: width is not banded (frames wider than ~16k device px still fail); stitching holds the
whole RGBA sheet in memory (a 5084×21256 PNG is ~430 MB raw).
