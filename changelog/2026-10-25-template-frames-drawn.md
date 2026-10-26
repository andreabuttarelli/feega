# Template frames are drawn again on the canvas

Every inserted template (split headline, SaaS monitor, …) showed an empty black
frame on the canvas, cloud and local mode alike. The doc and its fields were
fine; only the canvas drawing was empty.

Cause: a template lands in a frame as a `Precomp` clip whose comp holds the
`Custom` clip. `readClips` looked only at the top-level tracks, so it found no
clip to read through the DOM. The worker built the frame without reads, the
list came back `unsupported: unread`, and gpu-core never drew it.
`mountCustomReads` already got the flattened doc and worked; the two guards in
`frame-build.ts` and `CoreFrames.svelte` passed the raw one.

Fix: `readClips` flattens comps itself, so every caller sees the same clips.

Second defect on the same path: the still frame came from `restFrame`, which
cannot see inside a `Custom` clip and answered 0 — the template's empty
opening. `restFrameOf` now uses `coverFrame` (the frame the DOM node already
shows) when the doc has clips only the DOM can read.

Not fixed here: a frame whose custom CSS gpu-core cannot draw (SaaS monitor:
gradient backgrounds, a 3D transform) stays partial and shows its black stage,
because with gpu-core on no frame is handed to the DOM renderer.
