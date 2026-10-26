# Four GPU canvas drawing fixes

Found by the demo recorder; guarded by `tests/e2e/canvas-gpu-black-boxes.spec.ts`.

- **Black box while typing / new shapes black.** `card-face.ts` gave `element` nodes the
  `motion` face, which read `data.kind` and defaulted to `Frame`: a free element whose list
  was not drawable yet (fresh, or emptied by `hideText` while typing) fell back to a card with
  a black stage. The face now resolves the kind with `docKindOf(type, data.kind)`, so an
  element is a `Graphic` (transparent). The frame placeholder is also transparent instead of
  black.
- **Variants draw empty.** Not variants: "Buy now →" and "Added ✓" use glyphs DM Sans lacks.
  A missing glyph makes the text a gap and the whole frame undrawable. `faceBook` now falls
  back to Noto Sans Symbols 2 / Noto Sans Math; `fontLoader` asks Google for them with
  `text=` of only the characters past U+2000, so nothing extra loads for plain text.
- **Large data URL image fills.** The fill schema capped `src` at 4000 chars, so a pasted
  picture failed validation: not drawn, no crop. Links keep the 4000 cap; `data:` URLs may
  reach 16M chars.
