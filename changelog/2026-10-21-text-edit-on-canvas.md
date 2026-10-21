# Text editing on the core canvas (unify step 5)

Double-click (or Enter) on a text clip inside a core frame opens `CoreTextEdit`: one textarea over the core-drawn text, no editor swap and no bitmap stand-in.

- Pure rules in `frame-text-edit.ts`: `editsText`, `hideText`, `commitText` (setProps through `FrameEditSession`), `textEditStyle` (font stack of the doc, size = `size` x min(frame w,h) x screen scale, tracking, leading, weight, case).
- While editing, `liveDocs` carries the doc with only that clip's text emptied, so the core hides just those glyphs. The geometry is captured at open, in world units, and scaled by the zoom at render time.
- Esc or blur commits once (`Edited text`); unchanged text writes nothing. IME: Esc is ignored while composing. Auto-height grows with the text; the existing text-fit path applies after the save.
- `framePicker.frameSize()` added.

The pixelated stand-in is the frame-live poster swap in the old inline editor path; the unified path never creates it and it goes with step 10.

Not covered: rotated frames, non-built-in web fonts not yet loaded in the DOM (browser fallback until they are).
