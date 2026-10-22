# Bottom bar: frame tools on selection

Since #1104 the canvas page always passed the browsing context and `frameBar.host` was never
set, so "Insert image" and "Frame templates" never rendered.

- Bar contents are one table per selection (`bottom-bar.ts`): a selected frame appends
  `Image` + `FrameLibrary` to the canvas slots. No separate frame mode; Generate stays.
- Insert image: file picker -> `onPasteData({ kind: Image })` at the frame centre -> `upload`
  with `frameHolding`. Frame templates: `frameDialog = { nodeId, dialog: Templates }`.
- Removed: `CanvasState`, `barContextOf`, `barShift/Keys/Hidden/Shown`, `frameBar.host/attach/
  covered/editMode/sidePx`, `FrameAction`, the `barContext` prop, neighbour dimming driven by it.
- e2e screenshot specs default to `~/Documents/feega-videos/e2e` instead of the repo root
  (`tests/e2e/fixtures/shots.ts`).
