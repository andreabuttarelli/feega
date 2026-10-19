# gpu-full draws strokes, transitions, moves, blend modes, masks and mattes

Step 2 of the gpu-full roadmap (ADR 0018).

- **Strokes** (`stroke.ts`): polylines become band, join (miter with SVG's limit 4, round,
  bevel) and cap polygons, filled with a new `Union` rule; dashes cut by arc length. Inside and
  outside alignment double the width and clip to the shape through a stencil clip bit, as the SVG
  clip-path / mask do. Sided strokes stay unsupported.
- **Transitions and moves** (`edges.ts`) read the HTML engine's own `EDGE_HIDDEN`/`EDGE_SHOWN`/
  `MOVES` tables (exported from compose, not copied) and sample them with the same eases. A wipe
  is a frame-space scissor; a move on a clipped picture shifts the picture inside its box.
- **Blend modes**: the 15 W3C modes in one shader, composited against a resolve of the frame.
- **Masks** (`mask-layers.ts`): rect, ellipse, polygon, linear/radial ramps, picture alpha and
  luma, feather (gaussian), expansion (size offset, exact for rects), invert, opacity and the four
  stack modes folded as `combineMasks` does. Text masks stay unsupported (text engine).
- **Track mattes**: the source clip is drawn into the mask instead of the frame; alpha, luma and
  their inversions.

| Kind | mean SSIM | worst | pixels off |
|---|---|---|---|
| strokes (center/inside/outside, dash, open path, gradient) | 0.9986 | 0.9986 | 0.27% |
| transitions (all 8, in and out) | 0.9972 | 0.9966 | ≤0.40% |
| moves (drift, zoom, pan on pictures) | 0.9973 | 0.9963 | — |
| blends (15 modes over a picture) | 0.9971 | 0.9971 | — |
| masks (8 kinds incl. feather, invert, stack) | 0.9981 | 0.9981 | — |
| mattes (alpha, luma inverted) | 0.9983 | 0.9983 | — |

Earlier kinds unchanged (shapes 0.9989, gradients 0.9983, transforms 0.9999, images 0.9978).
