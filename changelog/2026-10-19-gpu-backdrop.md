# Backdrop blur only under the item, in gpu-full and gpu-core

Before: the TS WebGL2 backend blurred the whole frame behind a glass item (background-blur
effect), not just the area the item covers (SSIM 0.9746 vs HTML); the core skipped it.

Now both draw the item's silhouette (its shape in opaque white, so a 25% fill still blurs fully,
as CSS `backdrop-filter` does), blur what is behind, and keep it only inside the silhouette. The
core renders the items below into a texture for that, then joins it before the item like a layer.

Parity (WebGPU, 4 frames, vs HTML): TS 0.9746 → 0.9984, core skipped → 0.9984.

Also: the core now marks pictures dirty before every vello render, not once per frame — the
backdrop's extra render rebuilt the image atlas and pictures went black from the second frame.
