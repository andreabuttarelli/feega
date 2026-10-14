# Cursors and selections of the people in a frame

Before: the canvas listed peers as a comma-separated row of emails; inside a frame nobody saw
anyone.

Now cursors and selections travel as broadcast `frame` events on the existing private
`canvas:<id>` channel (its RLS already admits canvas members, so no migration). `frame-presence.ts`
holds the pure part (mark shape, colour per user, staleness, newest-wins) and a hub: the canvas
page and the full editor page each create one, pass its `line` to `connectCanvas`, and provide
its port by context to `MotionEditorShell`. Received marks are stamped with the local clock, so a
skewed clock cannot hide a peer. The editor sends on selection change, on pointer move (≤ 1 per
60 ms, trailing) and every 3 s; a mark older than 10 s is dropped, and leaving sends a null mark.
`FramePeers.svelte` draws named cursors and coloured outlines over the stage; the canvas shows
round avatars (`PeerAvatars.svelte`).

Discarded: Realtime presence `track` for cursors (heavier, rate limited) and a `frame:<nodeId>`
topic (needs a new RLS policy and a migration that deploys do not run).

Known: the outline uses the same measured boxes as the own selection box, which today draws too
small on the full editor page; both will follow the fix of that measurement.
