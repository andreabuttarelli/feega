# Text tool lands in the frame, typing never fires shortcuts, frames always draw

From the mobile case study (M11, M12) and the landing case study (#12, #13), 2026-11-02.

- **M12, text over an instance became a free element.** `frameUnderDrawing` (`GpuFlow.svelte`)
  took only the top node under the drawing's centre: a linked instance node lying over a frame
  hid the frame, and a 160 px text click near an edge put the centre outside it. It now walks every
  node under the point (`SpatialIndex.allAt`) to the first frame that can host the drawing, and a
  clicked text is placed by its click point (`drawnAnchor`, `canvas-draw.ts`), not its box centre.
- **M12, letters fired shortcuts.** Between the click and the text editor taking focus (node
  save, caret fonts) keys reached the canvas: typing "Shared" ran the E tool. `TypeAhead`
  (`canvas/type-ahead.ts`) holds printable keys from the click until the editor opens (5 s cap,
  Escape ends it) and `CoreTextEdit` starts with them, caret at the end.
- **#13, text in a drawn Stack landed at the frame root.** Drawing in a frame (from the canvas or
  inside the frame) now passes the new clip through `joinStackAt` (`layout/stack-drag.ts`), the
  same `dropInStack` a drag uses.
- **#12, long text jumped to X=0.** `fittedTextBox` (motion-core `text-sizing.ts`) clamped an auto
  width text into the stage by shifting its left edge; it now keeps the left edge and only holds
  the centre on the stage (the schema bound), so the text overflows to the right like Figma.
- **M11, frame blank or stale until reload.** `CoreFrames` dropped any build whose pictures were
  not all loaded (`Readiness.Partial`): a frame with one failed picture never drew on pan-in and
  never showed an edit. It now draws, blocking only the failed pictures (`drawable`,
  `core/placeholders.ts`). Not reproduced in a browser: if stroke/X/Y still lag on frames without
  pictures, the cause is elsewhere.

Guards: `type-ahead.test.ts`, `spatial-index.test.ts`, `canvas-draw.test.ts` (anchor, text into
stack), `text-sizing.test.ts`, `placeholders.test.ts`.
