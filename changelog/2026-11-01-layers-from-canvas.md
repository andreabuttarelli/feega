# Layers builds its tree from the canvas, and a reopen guard

Release #1678 froze a production canvas (landing 1440×4480, Tablet and
Phone views, components) on reopen. Local production builds of #1626 and
#1678 on the same seeded Ledgerline fixture with five styles, headed
Chrome, dpr 1.7: #1678 ran one 20–22 s main-thread task, 2.4 GB of JS
heap, Svelte `effect_update_depth_exceeded`, and Ctrl+wheel did not move
the zoom, on WebGPU and on WebGL. Culprit: the project style library
(#1651, with #1652/#1654) and its key-order comparison, fixed by #1679.
Without styles in the doc the two releases measure the same.

## Layers fetches nothing

#1627 kept a second path for the tree: an idle fetch to
`/p/…/c/…/frame-outlines` for every frame with a head, plus a hidden
`PartsProbe` iframe per poster to send its parts back. That read docs
the canvas already had, read frames the canvas never loaded, and its
answer (cached per revision) took precedence over the doc the canvas
held, so an empty or stale outline hid a loaded frame's children.

Now the tree is `heldOutlines(heads, layersSource.docs)`: rows for the
frames the canvas holds, built once per doc (WeakMap), and a frame it
has not loaded is its row alone until the canvas loads it. Removed: the
`frame-outlines` endpoint and its server reader, the probe lanes in
`LayersPanel`, `whenIdle`, `outlinesUrl`/`previewUrl` on `CanvasSide`.
Lost on purpose: the parts of a closed custom-clip poster, which the
server derived statically; they appear when the frame is opened.

## Guard

`tests/e2e/canvas-landing-session.spec.ts` (in `test:gate`) seeds the
Ledgerline fixture plus styles, opens, reopens, then zooms, pans,
selects, switches modes and zooms inside the frame. It fails on a task
over 2 s, a heap over 500 MB at reopen, an uncaught error, or a zoom
that does not move. Red on #1678, green on #1626 and on #1678 + #1679.
