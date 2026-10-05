# Motion node: in-node player, sized by format

## Before
- The node body showed only a clapperboard: the canvas never loaded the doc,
  and `posterAssetId` is written by nobody. Preview always empty.
- The node was 420×320 for every format, with no border; the 9:16 frame sat
  centred in a white box invisible on the white canvas. The selection ring
  framed the 420×320 box, not the black frame you saw.

## Now
- `motionNodeSize(format)`: width per format, height = picture + 44px bar.
  `nodeSize(type, data)` passes the node data so the canvas, share page and
  resize floor size the node by its format. The stage fills the node width.
- `GET /p/:project/c/:canvas/motion/:node/preview` composes the head revision
  (same scope check as the editor, moved to `server/motion/editor-scope.ts`).
- `MotionNode.svelte` mounts `MotionPreview` only when in view and engaged
  (hover, focus, tap, Play); released 3s after the pointer leaves while
  paused, after grabbing a still (`MotionPreview.still`) kept as poster in
  memory. Refetches when `docHeadRevision` changes (realtime on `nodes`).
- Controls: play/pause, stop, start, end, scrub, timecode, loop, mute; 44px
  targets; `nodrag nopan` and stopped propagation so they never drag or
  select the node. `MotionPreview` gained `muted`, `loop` and `still()`.

## Measured (dev server, 10 nodes 16:9)
- Idle: 0 players, heap ~49 MB, 60 fps.
- All 10 playing: 9 players, heap ~75 MB, 60 fps.
- After release: 0 players, heap ~53 MB.

## Discarded
- Persisting the poster to Storage: one write per hover; in memory is enough
  until a poster is needed outside the session.
- `capture()` for the poster: it reloads the same srcdoc and waits for a
  `ready` that never comes.
