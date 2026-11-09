# Frame heads: read by pointer, never by scanning history

`latestHeads` read every `(node_id, version)` row of every frame to find the newest version. On
long histories that was thousands of rows, and past PostgREST's 1000-row cap the response was
truncated: a frame could open on an old revision.

Now `latestHeads` takes `{ nodeId, version }` pointers from `nodes.data.docHeadRevision` (as
`compose.ts` already did) and reads those revisions in one query. A frame with no pointer, or
whose pointed revision is missing, gets its newest version with `order desc limit 1`, eight
nodes at a time. No migration.

A lagging pointer (revision written, node patch failed) is not detected: that would cost a
query per frame on every open. `sources.heads.test.ts` holds 1200 revisions with a 1000-row fake
cap and fails on the old scan.
