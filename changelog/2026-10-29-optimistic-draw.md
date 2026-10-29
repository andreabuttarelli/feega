# Drawn shapes show on the gesture, not after the save

A rectangle, text or path drawn on the canvas showed its selection outline at once and its fill
0.5–2.8 s later. The tile went in with `docHeadRevision: 1`, but nothing held its doc: CoreFrames
fetched `/motion/<id>/source` before `drawElement` had written the node (404), then again through
the worker fallback, and the fill appeared whenever a fetch happened to land after the insert.
Drawing over a frame was worse: a free element was saved, then moved in by `moveFree`, then the
frame refetched its new revision. Free text never opened its editor until the pick doc arrived.

Now the doc is built on the client and drawn from `liveDocs`, no fetch:

- `drawnTile` / `drawnFrameTile` return the doc the server will store. The server uses the node id
  as the clip id (`drawElement(..., place.id)`), so the predicted doc and the stored one are equal
  (`move-element.route.test.ts`) and later ops apply to the same base.
- GpuFlow seeds `liveDocs` with that doc (tokens from any held frame, `FEEGA_TOKENS` and a one-off
  `adoptTokens` fetch on an empty canvas). The frame session's saves are held (`holdSave`) until
  the node insert lands; a failed insert clears the live doc with the tile.
- A shape drawn over a frame goes straight into the frame's edit session (`drawnInFrame`, same
  `drawClip`/`penClip` the in-frame overlay uses) and saves as ops: no free element, no `moveFree`,
  no refetch. Frames that are rotated, linked or not loaded yet keep the old path.
- `onDraw`/`onDrawFrame`/`onAddBeside` return a `Drawing` synchronously instead of awaiting
  `decoded()` + `painted()` (deleted `paint-wait.ts`).

Measured, headed Chrome WebGPU, local dev against production DB, pointerup → fill pixels:

| case | before 1× | after 1× | before 4× CPU | after 4× CPU |
|---|---|---|---|---|
| rectangle over a frame | 794–2795 ms | 35–42 ms | 908–919 ms | 182–188 ms |
| rectangle free | 788–1587 ms | 40–45 ms | 588–904 ms | 186 ms |
| pen free | 506–766 ms | 37–41 ms | 608–1151 ms | 165–260 ms |
| text editor open, free | never | 80–172 ms | never | 443–454 ms |
| text editor open, over a frame | 827 ms / never | 51 ms | 1318–2452 ms | 267 ms |
