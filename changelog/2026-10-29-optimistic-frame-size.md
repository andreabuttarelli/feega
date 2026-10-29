# Frame resize, group scale, restore run and wires into frames: one path each

Four actions still bypassed the optimistic runner:

- **Frame resize** refit the doc locally only when the frame was the one published to Layers
  (`layersSource.video`); any other frame posted `frameSize` and waited for a refetch. GpuFlow
  now publishes `frameDocs` (`src/lib/canvas/frame-docs.ts`): an edit applied through the
  frame's `FrameEditSession` (`commit`), saved as ops like every other frame edit. The page
  refits through it for every frame with a doc on screen; `frameSize` is posted only for a frame
  whose doc is not loaded yet.
- **Group scale** applied locally with no rollback: now the `ScaleGroup` registry row.
- **Restore a run** applied locally with no rollback, then refreshed: now the `RestoreRun` row
  (refresh after idle; a `conflict` rolls back).
- **Connect to a motion frame** posted `connect` and drew the wire on the answer. The server
  no longer links anything into the frame for that case, so it now takes the line queue like
  every other wire (client id, offline retry, refusal undoes it).

| Action | Before | After (server delayed 2 s) |
|---|---|---|
| Element resize (doc refit) | 16 ms | 17 ms, no `frameSize` request |
| Group scale | 13 ms | 11–12 ms (now with rollback) |
| Restore run | local, no rollback | local + rollback (unit test only) |
| Wire into a motion frame | waited for `connect` | line queue (no UI path draws one today: motion frames have no input port) |
