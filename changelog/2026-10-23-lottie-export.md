# Lottie and dotLottie export

New image-export rows `lottie` (.json) and `dotlottie` (.lottie), next to svg/pdf.

- `src/lib/motion/export-lottie.ts` turns one display list per doc frame into a Lottie: each
  drawn item is a shape layer. Transforms (position, scale, rotation, opacity) become keyframes,
  reduced so a linear move is two keys; geometry that changes is held per frame, padded to one
  vertex count (lottie-web renders a hold with mixed counts wrongly). Solid, linear and radial
  fills, rectangle/ellipse/polygon path masks, text as outlined shapes. A skewed pose is baked
  into the path.
- Left out and listed in `skipped` (dialog, CLI, MCP): blend modes, effects, mattes, blur, wipes,
  pictures, gradient/picture/feathered masks, live components. Strokes are filled bands, not Lottie strokes.
- Up to 30 s (`LOTTIE_MAX_SECONDS`); a still frame is one frame. An element export keeps only
  that element's layers at the frame size.
- No browser: `needsBrowser(rows)` now gates the renderer check, so svg/lottie work without it.
- Rows got `FILE[format].ext` (json, lottie), `Drawing.Animation`.
- Checked: lottie-web in Chromium vs the SVG of the same frames at 0/30/60/89: under 0.01%
  pixels differ. Not run: the Playwright export dialog for Lottie.

Deviation from the roadmap: it names `render_video format=lottie`; this is a document export, so
it is `export_selection` rows, not a farm render.
