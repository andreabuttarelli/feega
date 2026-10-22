# Text paragraphs: justify, vertical align, spacing, indent, title case

Roadmap W1-D, rows TX-02, TX-03, TX-06, TX-09 (title only).

- Text props (Text only, `paragraph()` in `components.ts`): `align` gains `justify`,
  `verticalAlign` (top/center/bottom, Fixed box), `paragraphSpacing` and `paragraphIndent` in em.
  `textCase` gains `title` for every text kind.
- GPU layout (`gpu-full/text/layout.ts`): indent starts the first line of each paragraph,
  justify spreads the free room over inter-word gaps on every line but a paragraph's last,
  spacing goes between paragraphs only. The painter and the caret share `topOf` for the vertical share.
- The Rust core (`gpu-core`) does not know these yet: `coreTypography(plan)` sends a text that
  uses them through the TS outline path instead. Keeping the wasm untouched kept the PR small.
- Export: `text-align:justify`, flex `justify-content` for the vertical share, a `<div>` per
  paragraph with `text-indent`/`margin-bottom` only when spacing or indent is set (styled
  ranges split at newlines so each span stays inside its paragraph). Title case is CSS `capitalize`.
- Inline editor: `text-transform` and vertical share follow the props. Paragraph spacing and
  per-paragraph indent cannot be expressed in a textarea; while typing they show unspaced.
- MCP: `set_props` carries the new props; the motion prompt names them.
- e2e `text-typography-parity.spec.ts`: canvas vs export ink box per case.
