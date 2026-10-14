# snapshot and revision have an /api/v1 op

Step 1 of moving the canvas page actions to `/api/v1` (ADR 0009, option d). `snapshot` was
mapped to `list_nodes`, which returns nodes only; `revision` was marked ui-only. A static build
needs both to resync an open canvas.

The snapshot body and its readers (`loadGenRuns`, `loadDownloaded`, influencer views) moved
verbatim to `server/canvas/snapshot.ts`; the page load imports the readers from there.
`canvas_snapshot` calls `canvasSnapshot`, `canvas_revision` calls the existing `canvasRevision`
with the caller's membership of this org only. Client unchanged.
