# Poster with a photo no longer renders white on gpu-core

Poster photos are SVG `<image>` elements. The DOM read treated them as a gap (`DomGap.Media`), and a frame with any gap is not drawn whole, so the canvas kept the white placeholder. Posters without a photo (still-life drawn in SVG shapes) had no `<image>` and rendered.

Fix, in two parts:

- The probe gives an SVG `<image>` a bitmap (honouring `preserveAspectRatio` slice/meet/none) and the reader draws it as a layer at its own x/y.
- The probe loads images with `crossOrigin = "anonymous"`. Without it a remote image (signed storage URL) taints the canvas, and `postMessage` of the bitmap fails with `DataCloneError`, leaving the clip `unread`. Applies to url() backgrounds too.

Discarded: switching `picture()` in poster-kit to an HTML `<img>`; it would leave every other SVG `<image>` unsupported.
