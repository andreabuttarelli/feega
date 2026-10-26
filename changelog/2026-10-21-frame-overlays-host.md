# FrameOverlays: world-space overlay host (step 3, canvas-editor-unify)

Adds `FrameOverlays.svelte` and `canvas/frame-screen.ts` (frame world rect + bar + viewport zoom/pan to screen rect and point map). Mounted in `GpuFlow` behind `?unifiedFrames=1`, off by default, empty children for now.

The editor overlays already size from their host's bounding rect and use percent coordinates, so they work unchanged inside a frame-sized host div; nothing in them assumes the shell stage beyond that. Step 4 renders them into the snippet.
