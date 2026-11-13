# Shared canvas draws motion frames and elements

Before: `SHARED_VIEW_OF` mapped `motion`/`element` to `empty`, so a canvas made of frames shared as a
blank board; only published frames had a viewer (`/s/[token]/[frame]`).

Now: `readSharedCanvas` adds `frame` (only `kind`, `docHeadRevision`, `linked`) to doc-holding
nodes; the share page passes them to GpuFlow as `nodeSummaries` with a `sourceUrl` pointing at
`GET /s/[token]/source/[node]`. That route reads with the declared share service role
(`readSharedSource`): the node must be live on the token's canvas; it returns the current head,
brand tokens and only the assets the doc uses, signed via `signSharedMedia` (the member signer
demands an RLS client). GpuFlow skips poster uploads in View mode.

Discarded: publishing every frame on share (writes, and persists after the link is revoked).
Linked mains a frame uses are resolved like in the editor, so a component's main from another
canvas of the same org is drawn inside it — needed to draw the frame, nothing else of it leaks.
