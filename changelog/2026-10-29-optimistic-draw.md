# Drawn and duplicated nodes show on the gesture, not after the save

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

## Duplicate

⌘D, Alt-drag and the menu Duplicate waited for the `duplicate` action before adding anything
(0.3–0.7 s), and a frame copy then fetched its doc. ⌘D on an element picked inside a frame was
worse: `Command.Duplicate` was missing from `FRAME_KEYS`, so it fell through to the canvas and
copied the whole frame.

- `copyPlan` (pure, moved out of `server/canvas/duplicate.ts`) plans copies on both sides; the
  client generates the copy ids and sends them as `copy_ids`, the server writes under them.
- The page adds the copies at once (`copiedNodes`) and settles them with the saved rows; a failed
  save removes them with a notice. Saves run in order, so ⌘D on a copy still saving waits for it.
- GpuFlow gives each doc copy its source's live doc (`holdLive`), so the copy draws without a
  fetch. A doc node whose source doc is not held yet falls back to adding after the save
  (`Landing.OnSave`).
- ⌘D on a picked element runs the frame's own Duplicate, in the frame's session.

Keypress to copy visible:

| case | before 1× | after 1× | before 4× CPU | after 4× CPU |
|---|---|---|---|---|
| element in a frame (⌘D) | 518–633 ms, and it copied the frame | 8 ms | 518 ms | 48 ms |
| frame | 515–672 ms | 17 ms | 633 ms | 56 ms |
| Generate text node | 272–450 ms | 13 ms | 352 ms | 61 ms |
