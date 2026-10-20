# Core canvas: text editing drawn by the core

Figma model: the core draws the text, the caret and the selection; a hidden textarea only holds
the text and the selection range for keyboard, IME and clipboard.

- `text/caret.ts` turns the layout that draws a text (`layOut`, via `place` in `painter.ts`) into
  per-line stops: `hitTest`, `charUnder`, `caretRect`, `selectionBoxes`, `nextLine`, `lineEdge`,
  `wordRange`, `lineRange`, grains for click/double/triple click. `textCaretAt` in `display-list.ts`
  adds the clip's world matrix (parent, edge, move, rotation, scale), so the overlay maps core
  metrics to the frame and is crisp at any zoom (SVG, non-scaling stroke).
- `CoreTextEdit.svelte` (inside `SelectionOverlay`) owns the textarea, the pointer gestures
  (click, drag, double click word, triple click line, shift-click), Home/End/Cmd+Left/Right and
  Up/Down on core lines, the IME underline from composition events, and the blinking caret
  (steady under `prefers-reduced-motion`). Typing writes the doc on every input; the core redraws
  from the live doc (#1049). Cmd+Z inside the field is the textarea's own undo.
- The DOM host of the editor stage is hidden while a core text edit runs (`data-core-text`), so
  there is no second text; `typingInCore` pauses the host-fit effect, which wrote DOM-measured
  sizes back over the typed text.
- `liveDocs.set/clear` read `map` untracked: an effect that published a doc depended on the map it
  wrote and hit `effect_update_depth_exceeded` as soon as the doc changed on every keystroke.
- Falls back to the DOM contenteditable when the text is not laid out as typed: collapsed spaces
  (Title, Kicker, Caption with double spaces), changed case, a glyph the faces do not cover.

Not done: bidi and RTL (stops are left-to-right), emoji and ZWJ clusters (one stop per code
point), vertical text, trailing spaces at the end of a wrapped or last line (the layout draws no
glyph for them, so the caret does not advance until the next character), CJK without a covering
face (the core draws nothing, so the old picture stays), parts of custom templates (still DOM).
Checked in headed Chrome as test@dazero.co: `tests/e2e/core-text-edit.spec.ts`, shots in
`~/Documents/feega-videos/shots/core-text-edit/`.
