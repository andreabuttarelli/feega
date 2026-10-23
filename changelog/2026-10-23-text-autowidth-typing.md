# Auto width free text grows while typing

Three defects clipped a free text set to auto width:

- `freeTextFit` used `fittedTextBox`, which caps the box at the stage. A free text's stage
  is its own node, so the host could only shrink, never grow. New `fittedShare` returns the
  uncapped share; texts inside a frame still clip to the frame.
- Switching Resizing in Properties was lost: autosize resized the node through the server
  `frameSize` before the debounced save of `sizing` landed, so the server head (old
  sizing) won. `fitTextBoxes` now flushes the pending save first.
- While typing, the node's dashed editing ring stayed on the stored box. A free text
  being typed now drops the ring (`Level.Typing` in `selection-chrome.ts`); the editor's
  own outline follows the text.

Guarded by `tests/e2e/canvas-text-autowidth-typing.spec.ts` (auto width and auto height).
