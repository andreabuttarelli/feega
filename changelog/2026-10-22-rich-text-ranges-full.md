# Rich text: every type property per range

Ranges (2026-10-22-rich-text) held colour, weight and italic. Figma lets any selection carry its
own type, so ranges now also take font family, size, letter spacing, line height, underline,
strikethrough, case and opacity.

- Model: `text-runs.ts` style keys extended; `rangeValues` reads a selection as one value per key
  or `mixed`; `runEditSchema` is the agent's edit (null clears a key).
- GPU: `layout.ts` asks per character for a `Look` (request, size, tracking, leading); with ranges
  each line takes its height and baseline from its tallest glyph (CSS line-box rule), without
  ranges the old uniform path is untouched. `painter.ts` draws each glyph at its own size, adds
  underline/strike bars as contours of the same paint, fades by run opacity, applies run case.
  A run size is relative to the box size, so fit-to-box scales it with the rest.
- HTML: span CSS gets family, `em` size (scales with fit), letter-spacing, line-height,
  text-decoration, text-transform, opacity. Run fonts are loaded with the clip font.
- Canvas: `text-range.svelte.ts` holds the editor's text, runs and selection; the Properties panel
  shows a "Text · selection" section while typing (Mixed when values differ) and edits only the
  selection; clicking into it keeps the editor open, a click elsewhere commits. ⌘U underlines.
  Fixed: ⌘A inside the text editor selected frame elements instead of the text.
- MCP: `style_text_range` takes `style` with every key.

Not done: gradient fills per range (a range takes a solid colour), live preview of range styles
inside the textarea while typing (left to the WYSIWYG editor work).
