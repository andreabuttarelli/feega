# Text editing draws with the engine

**Before:** double-click hid the clip (`opacity: 0`) and showed a visible contenteditable styled by CSS. Browser shaping, wrapping, tracking and fallback fonts differed from the GPU engine's skrifa/vello layout, so text jumped on entering and leaving edit.

**Now (option a):** the engine keeps drawing the clip; each keystroke (and each IME composition step) sends the typed text to the live doc via `typedText`, and the caret layout is recomputed with `caretSource`. The contenteditable is `opacity:0`: it only owns focus, IME, clipboard and undo. Caret and selection are drawn from engine `CaretLine`s (`editMarks`), and mouse press/drag/double/triple click hit-test the engine layout (`hitTest`, `pressed`, `dragged`). Edit and final are the same pixels by construction.

**Discarded:** (b) matching the DOM overlay to the engine — two shapers never agree for every font, fallback and wrap.

**Known gaps:** Up/Down and Up/Down still move by the hidden DOM layout, which can differ at wrap points; IME composition has no underline.
