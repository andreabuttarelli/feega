# Poster text edited in place is kept

Clicking the empty canvas after typing in a poster headline showed a black
frame and reverted the text. The click took focus out of the preview iframe
without blurring the edited element, so no end message came; the editor
then tore down with the typed text only in the iframe.

- The iframe ends the edit on window blur, sending the typed text.
- The overlay keeps the last typed text and commits it if it is torn down
  first; the shell flushes it before its own pending save.
- Discarded: saving on every keystroke, since a doc write recomposes the
  preview and ends the edit.

Guard: tests/e2e/poster-text-kept.spec.ts, five ways out, frame sampling
for black, DB and reload.
