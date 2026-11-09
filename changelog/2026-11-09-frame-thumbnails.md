# Frames reopen from a cached thumbnail

A reopened canvas stayed white until every frame had been fetched, built, uploaded to the GPU and
rastered: 4–5 s at 1x CPU on the landings fixture, 12 s at 4x.

Once a frame is fully drawn and wholly on screen, the canvas copies its pixels from the WebGPU
canvas into a small WebP (512 px longest side at most). The copy goes to IndexedDB
(`feega-frame-thumbs`), keyed by the frame key (id, revision, linked, scenes). On the next open,
each on-screen frame's thumbnail is drawn at once as a single picture (`frame-thumbs.ts`), and
the real list replaces it when it is pictured. A new revision has no thumbnail and loads as
before.

Not covered yet: the first open on a device (cold), which needs posters saved server-side on
save, and breakpoint views, which showed no thumbnail in the recording.
