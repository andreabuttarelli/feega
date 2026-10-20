# gpu-full: text (roadmap step 3)

Title, Text, Kicker and Caption are drawn by `?engine=gpu-full` as glyph outlines through the
existing stencil-and-cover raster: no DOM, no browser text raster.

- `gpu-full/text/`: `face.ts` (port: shape + outline per face), `fonts.ts` (@font-face rules →
  CSS font matching: family, style, weight groups, unicode-range subsets, wght/opsz axes like the
  browser, font-variation-settings, synthetic oblique), `fontkit-face.ts` (adapter), `layout.ts`
  (CSS-like lines: collapse/pre-wrap/pre, greedy wrap, letter-spacing after every character,
  ligatures off when tracked, LayoutUnit line height, floored half leading), `painter.ts`
  (per-component table: fit-to-box via the same `fitSize`, auto width/height, safe box, Title
  line rise masked by polygon clipping, Text fade-up, Caption box), `load.ts` (same CSS URLs as
  the HTML engine, only the subsets the clips use, cached).
- The Rust core (HarfRust + skrifa + Parley) replaces the adapter behind `Face`/`FaceBook`.
- fontkit (MIT) is used, not ported. Its WOFF2 path ignores gvar on outlines, so glyf outlines
  are decoded and varied by our code (`outlinePoints`).
- macOS Chrome darkens and lifts glyphs (CoreText smoothing): `Smoothing.Dilated` reproduces it
  from the user agent; elsewhere glyphs are plain.
- Named, not drawn: text animators, text on a path, gradient/image text fills, text strokes,
  characters no loaded font covers, missing fonts.
- Parity is against the live DOM (`--ref=live`); the export capture path (SVG foreignObject)
  lays text out with different advances and scores ~0.98.
