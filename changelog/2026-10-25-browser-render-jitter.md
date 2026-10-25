# Browser render: lanes lay out alike, blur eases to none

Signal: free in-browser exports of Custom components trembled every 4th frame
(static caption 3 px higher, CTA button text wrapping to two lines) and a
`from {filter: blur(18px)}` held full blur, then snapped sharp.

Causes:
- The capture splits frames over 4 lanes. Lane 0 is the preview's own player,
  whose iframe `keepCrisp` turns `scale()` into CSS `zoom` (sharp preview in
  Chromium). Zoom propagates into the iframe: text lays out at half scale,
  different line boxes and wraps. Lanes 1-3 (fresh players) keep the transform.
- The engine's `interpolate` could not tween `blur(18px)` to `none`: shapes
  differ, so it returned the start value until progress 1.

Fix: `keepCrisp`'s release restores the player transform; `MotionPreview`
releases it for the duration of an HTML capture (`atFullSize`). The engine
fills `none`/empty with the identity of the other side's filter list
(table `FILTER_IDENTITY`; `drop-shadow` and unknown functions keep the old
behaviour).

Measured on the same 3-component frame, local render, 12 cores / 4 lanes:
caption y spread 3.0 px -> 0.0 px; CTA text centroid spread 9.3x16.5 px ->
0.7x0.4 px; node edge velocity sign flips 7 -> 1. Evidence in
~/Documents/feega-videos/evals/jitter-fix-2026-10-25/.
