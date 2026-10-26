# Ordered and unordered lists in text

Rich text v2, part 2. A paragraph of a Text clip can be a list item, nested up to six levels.

- Data: `props.lists`, one entry per paragraph (`{ kind: bullet | number, level }` or null),
  `text-lists.ts`. Paragraph-indexed rather than per character: a list is a paragraph property,
  and Enter, a deleted line break or a pasted block shift it with `shiftLists`, as `shiftRuns` does
  for ranges. Markers are computed, never stored: `markersOf` numbers each level on its own (1. a. i.),
  restarts a run after a plain paragraph or a different kind, and every bullet is U+2022 (a glyph
  every catalogue font has; the hollow and square bullets of Figma are not in them, and a missing
  glyph makes the whole text refuse to paint).
- Layout (`layout.ts`): a list paragraph has an inset of `(level + 1) * 1.5em`, wraps in
  `room - inset` and hangs its marker right-aligned in the gutter, 0.4em before the text. The first-line
  indent (`paragraphIndent`) and paragraph spacing (#1142) stack on top unchanged. Alignment applies
  to the text box left after the inset, as CSS padding does; the caret follows the same origin.
  A marker takes the paragraph's base look, not the style of its first character.
- HTML export: each list paragraph is a `position:relative` div with `padding-left` and an absolute
  marker span; same em values, so canvas and export match (checked in a browser, screenshots
  `richtext2-lists-*.png`).
- Editing: shift-cmd-8 bullets, shift-cmd-7 numbers, Tab and shift-Tab nest and lift, Enter on an empty item or
  Backspace at the start of an item leaves the list; the Text · selection panel has the same
  buttons. MCP: `text_style` takes `list` (bullet, number, none, nest, lift) over `start..end`.
- Not done: while the caret is open the textarea cannot indent per paragraph, so the markers show in
  the gutter left of the box (no nesting shown); the hanging indent appears on commit.
