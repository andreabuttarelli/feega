# Live drag and resize preview for peers

Peers used to see a node jump on drop: positions travelled only as the
committed write. Now the dragging tab adds `live` boxes (`{id, x, y, w?,
h?}`) to the same coalesced `canvas-peer` tick; peers draw a dashed ghost
in the dragger's colour. Broadcast is preview, DB is truth: the place
save is unchanged and a lost tick costs nothing.

On drop the sender clears `live`; the receiver keeps the last box
(`keepCanvasMark` → `dropped`) until the committed tile sits there
(`landedAt`) or `SETTLE_MS` passes, so the ghost never snaps back to the
old spot while postgres_changes catches up.

Drag comes from `onnodedrag`, resize from `NodeResizer.onResize` via
`tile-live-context`. Rotation is not previewed: the local rotate handle
itself applies only on pointer-up.

Adaptive rate: the coordinator's load test (Pro, 20 Hz, 20 s) gave 0 %
loss and p95 44 ms at 5 peers, 2.7 % loss, refused sends and a closed
channel at 10. `hzFor(peers, Plan.Pro)` keeps peers² × hz under the
500 msg/s quota (20 Hz up to 5 peers, 5 Hz at 10); `crowd()` retunes the
tick when presence changes. Refused sends are dropped; the link already
reconnects; commits stay on the save queue.

e2e `canvas-cursors.spec.ts`: ghost visible in the other tab ~470 ms
after drag start (includes 20 pointer steps), gone after the commit, both
tabs agree on the final x.
