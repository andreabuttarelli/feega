# Text decoration and OpenType features

Roadmap W1-D, rows TX-10, TX-12, TX-09 (small caps).

- Text props: `decoration` (none/underline/strikethrough), `decorationStyle`
  (solid/double/dotted/dashed/wavy), `decorationThickness` and `decorationOffset` in em with
  concrete defaults (0.06/0.1, never CSS `auto`, so canvas and export agree), `decorationColor`
  ('' = text paint), `skipInk`, `features` (`'tnum' 1, 'liga' 0`). `textCase: small-caps`
  is the `smcp` feature everywhere, never synthesized: a font without it shows lowercase in
  canvas, export and editor alike.
- `decoration.ts` holds the vocabulary and the CSS both export and inline editor write.
  `gpu-full/text/rules.ts` draws bars per glyph, dash/dot phase by absolute x so patterns run
  across glyphs; skip ink cuts the bar where a glyph's outline crosses the band.
- `Face.shape` takes features; fontkit passes them to its shaper. The Rust core is bypassed.
- Known gap: Chrome decorates the trailing space at a wrap in `pre-wrap`; the canvas does not.
