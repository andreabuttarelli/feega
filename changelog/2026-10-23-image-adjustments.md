# Image adjustments

Figma lets an image paint be corrected without leaving the file: exposure, contrast, saturation,
temperature, tint, highlights, shadows.

- `fill/adjust.ts`: one optional `adjust` object on the image fill, seven numbers in -1..1, absent
  when untouched. `adjustLook` turns it into one 4x5 colour matrix (exposure, then temperature and
  tint, then contrast, then saturation) plus a 17-step tone curve for highlights and shadows.
  Exposure is one stop at 1; the curve keeps black and white where they are and never reverses.
- Both renderers read the same numbers, so the canvas and the export cannot disagree on the look.
  HTML: an inline sRGB `<filter>` (`feColorMatrix` + `feComponentTransfer`), named by its values so
  equal looks share one, referenced from the layer. Canvas core: the same filter as an SVG filter
  on the picture item only, not on the shape around it. No Rust change: the core already runs
  those two primitives.
- Text filled with a picture is adjusted on the canvas core; the CSS text paint (HTML) has no way
  to filter a background and ignores it. SVG export names the filter as skipped.
- Properties: seven sliders under the image fill and a reset.
- Checked in Chromium, canvas against export, same document:
  `~/Documents/feega-videos/e2e/img-fills-compare.png` (`tests/e2e/image-fills.spec.ts`).
