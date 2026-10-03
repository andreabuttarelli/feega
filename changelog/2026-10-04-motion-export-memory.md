# Motion export: pictures inlined once, small

**Before.** Every exported frame went through html-to-image, which re-serialised the
whole scene into one SVG data URL — with every picture inlined at full resolution. On the
28 s trailer (4 product PNGs, several instances each) that was ~18 MB of SVG per frame.
The tab's renderer grew ~20 MB per frame (probe: 3.9 GB at frame 160) and crashed around
frame 770/840, three times out of three, after ~15 min.

**Now.** Before each capture, `inlineMedia` swaps every remote `<img>` and CSS
background picture for a WebP copy capped at 1280 px, made once per URL for the
whole capture session (`shrinkImage`). Same 28 s, 1080p export: completes, 10.6 min
(≈1.5× faster, 1.3 fps vs 0.88), renderer RSS stays in 0.9–3.3 GB and is reclaimed
by GC instead of climbing.

**Discarded.**
- Zeroing the html-to-image canvas after `createImageBitmap`: no change in growth.
- Decoding the SVG through a revoked blob URL instead of the data URL: Chrome marks a
  foreignObject SVG loaded from a non-data URL as tainted, and the bitmap can no longer
  be posted to the parent (`DataCloneError`), so every capture timed out.

**Not done.** Pictures above 1280 px lose detail when a scene zooms past that size.
Further speed (reusing unchanged layers, not re-serialising per frame) needs a capture
path other than html-to-image; the server renderer is the other route.
