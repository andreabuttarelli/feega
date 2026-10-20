# gpu-full: analytic path coverage and browser pixel snapping

On the saturn posters, what was left against the live DOM was edge anti-aliasing and
sub-pixel placement.

- **Analytic coverage** (`coverage.ts`). The headless browser gives WebGL2 4 MSAA samples, so
  edge coverage came in 5 levels (64-value steps). Non-zero and even-odd paths now add up
  exact signed area per pixel in an R16F target (one instanced quad per edge, from the edge to
  the path's right side) and cover once with that coverage. Union strokes and `within` clips
  stay on the stencil path.
- **Text placed like Chrome**: the baseline is the line top plus the rounded ascent, upright
  baselines snap to whole device pixels, glyph x snaps to quarter pixels (Skia's subpixel
  bins), the baseline rounds in local space under a transform, and a transformed element
  paints from a whole-pixel offset. Rasterised fallback text follows the same rules and is
  placed at whole-pixel page coordinates, so its layer is never resampled.
- **Boxes snap to device pixels** (HTML backgrounds and borders), as Chrome does.
- **Hard-stop gradients become solid bands**: one path per colour across every tile, so the
  grid backgrounds have no seams between abutting tiles.

Live-DOM parity: iso-blocks 0.9858 → 0.9981 (1.06% of pixels off), photo-grid 0.9831 →
0.9972 (0.99%).
