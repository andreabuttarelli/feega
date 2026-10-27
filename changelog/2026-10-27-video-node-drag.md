# Video node drag

Dragging a video node by the video area did nothing; only the rest of the card moved it.

Cause: `GpuFlow.svelte` listed `video` in `INTERACTIVE`, so `onDown` returned before starting a gesture for any press on a `<video>`.

Fix: `press-owner.ts` `ownsPress` keeps a press with the video only on its bottom controls strip (`CONTROLS_STRIP_PX`); the rest of the video starts a node drag. Keyboard handling still treats `video` as interactive.
