# Text editing: type-ahead window and Home/End

Two defects from the durability audit (round 2, s1b).

**First key lost.** `startTyping` released the held type-ahead keys when it built `typing`, but
`CoreTextEdit` only focused a tick after mounting. Keys landing in that gap reached `GpuFlow`'s
keydown with nothing holding them and were dropped. `typed` is now a function the editor calls
after it has focus, so the hold covers the whole gap. Not reproduced locally (the audit ran two
clients under load); fixed on the race the code shows.

**End replaced the text.** On macOS Chromium, End/Home in a contenteditable do not move the
caret, so the whole-text selection from the double-click stayed and typing replaced it. The
editor now handles Home/End itself via `Selection.modify(..., 'lineboundary')`; the key table is
`lineMove` in `editable-text.ts`.

Tests: `editable-text.test.ts` (lineMove), `tests/e2e/canvas-text-first-key.spec.ts` (@real).
