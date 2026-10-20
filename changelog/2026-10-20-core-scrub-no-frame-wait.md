# gpu-core scrub: the DOM read no longer waits a vsync

`?engine=gpu-core` draws Custom / Device3D clips from a hidden DOM page (`dom/probe.ts`). Every
`readAt` ended with `requestAnimationFrame` inside that iframe, so each scrub step cost at least
one vsync (19-26 ms measured) before the core drew anything, and the serial read-then-draw loop
topped out near 40-50 fps with a frame of latency. Seek, read and bitmaps took under 1.5 ms.

The wait exists for canvases (Three.js paints on its own rAF after a seek). It is now taken only
when a requested clip root contains or is a `<canvas>`; DOM and SVG clips answer at once.

Measured with the new `npm run bench:gpu-parity -- --doc=<doc> --mode=scrub` (a 2 s triangle
sweep of the playhead, 5 s, Chrome desktop, Metal): per-frame work p50 20-33 ms to 3-14 ms; pixels
identical (SSIM against the HTML engine unchanged on the three docs).

Not changed, found while measuring: docs with a real Three.js canvas (supasito) still pay the
vsync; the hidden HTML player is still seeked on every scrub step; layer-heavy docs (16 filter
clips) are GPU bound in the core (`layers.rs` renders one vello pass per layer per frame).
