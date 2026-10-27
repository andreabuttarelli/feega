# Every new text starts auto width

#1252 fixed the click path only. Two other entry points still made a text
that wraps at its starting box:

- **Chat / MCP / agent draw** (`drawnElement` → `drawClip`) with no
  `sizing`: `drawClip` defaulted to `auto-height`, so the text wrapped at the
  box the agent gave.
- **Tiny drag with the text tool** (a click with a few px of jitter):
  `DrawOverlay` treated any movement as a drag and made an `auto-height` text
  in a few-pixel box, which never opened for typing.

Now `NEW_TEXT_SIZING` (auto width) and `DRAGGED_TEXT_SIZING` (auto height)
live in `text-sizing.ts`; `drawClip` defaults to the first, and every
new-text caller (draw overlay click, plain paste, SVG paste, paste into a
frame) uses it. A text-tool drag under 10 screen px counts as a click. A real
drag keeps the Figma rule: fixed width, grows down.

Checked and already right: click (bar button, Shift+T), click inside a frame,
pasted text. Templates and dropped generated text keep fixed boxes on
purpose: they are designed layouts.

e2e `canvas-new-text-entry-points.spec.ts`: bar click, Shift+T, tiny drag,
in-frame; zoom 1 and 2; a 60-char sentence stays one line, Enter makes two,
stored sizing `auto`, node at least as wide as the typed line.
