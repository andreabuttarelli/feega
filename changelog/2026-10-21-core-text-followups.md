# Core text edit follow-ups

- The editor stage's DOM host is hidden whenever the canvas renders with the core (`data-core-drawn`
  on the preview, set by `SelectionOverlay`), not only during a text edit: no ghost text under the
  core's picture. The DOM fallback edit (`inPlace`) keeps it visible for its caret.
- `fittedTextBox` clamps the box to the stage. An auto-sized text taller than its frame wrote
  `y`/`height` above 1, and the doc then failed validation (`writePartText` refused every edit).
- Trailing spaces on the last line of a paragraph advance the caret by a space (`Shape.space`, the
  advance of a space glyph in the text, else 0.25 em). At a wrap they stay hidden, as drawn.
- Custom-template parts stay on the DOM path: their text is laid out by the DOM, there is no core
  layout to read.
