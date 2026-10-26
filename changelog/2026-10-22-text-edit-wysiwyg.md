# Inline text editor matches the drawn text; auto sizing measures the GPU layout

Before: the canvas text editor (`CoreTextEdit`) sized itself from the clip's HTML outline and
the raw font size, always centred vertically and always wrapped. Auto-width texts turned
centred and wrapped while editing; fixed texts showed the unshrunk size. After commit nothing
re-measured the text on the GPU canvas (`fitTexts` ran only in the motion editor shell, from DOM
boxes), so auto-width/auto-height boxes kept their stored size and the render clipped.

Now:
- `caretOf`/`textCaretAt` also return the laid size, box and anchor. The editor's CSS comes from
  that caret (`editLayout` + `editCss`, one flow table): same fitted size, wrapping, anchor and a
  single `matrix()` for zoom, frame scale and rotation.
- `textBoxesAt` measures every text with the GPU layout; `text-autosize.ts` turns that into a
  stored box (frames: `fitTexts`) or a node resize (free texts: `freeTextFit` → `onResize`), one
  row per `FrameKind`. It runs after every recorded edit (typing, Properties, mode switch).
- e2e `canvas-text-edit-wysiwyg.spec.ts`: 3 modes × 3 alignments compare glyph boxes before,
  during and after editing; one case switches to auto width and checks the selection hugs.

Not covered by e2e: free text elements (unit-tested only).
