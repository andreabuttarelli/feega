# gpu-full paints text strokes and gradient fills

Text with a stroke, a gradient, several fills or a translucent fill used to be named `stroke` or
`fill` and skipped. Now:

- strokes follow `-webkit-text-stroke`: the first visible stroke, centred on the undarkened
  outline, miter joins; `outside` is twice as wide and drawn under the fill;
- fills follow `background-clip: text`: linear (CSS gradient line), radial (an ellipse, drawn as a
  circle in a squashed space so the display list keeps one radius) and solid layers, bottom first,
  each faded by its opacity. The gradient box is what the page paints: each Title line block, the
  whole Kicker, and for inline Text and Caption one strip sliced across the lines
  (`box-decoration-break: slice`).

Still named: angular, diamond and image fills, blended fills, and non-plain fills under text
animators (the page clips the parent's background to transformed inline-blocks).

Paint types moved to `gpu-full/paint.ts` so the painter can use them without a cycle.

Parity (`kinds.ts painted`, `--ref=live`, 4 frames): mean SSIM 0.9959, worst 0.9953, ≤1.10% pixels off.
