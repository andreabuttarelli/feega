# Blocky text on the WebGL canvas: own GL passes leaked BLEND off

Text on a dark fill (white "New in Feega" on a black Stack) rendered with a
coarse halo of 4×4 px blocks in the canvas background colour around each
glyph. Display list was clean; it appeared on some loads only (#1597 report).

Cause: the WebGL backend (`web_gl.rs`, used when no WebGPU adapter exists, e.g.
headless Chromium) shares one GL context between vello_hybrid and gpu-core's
own passes. vello_hybrid enables `BLEND` (ONE, ONE_MINUS_SRC_ALPHA) once in
`WebGlRenderer::new` and assumes it stays on. `GlRunner::pass` (filters,
`flipped` after every layer/picture render) and `GlReprojector::draw` (every
present) disabled `BLEND` and never restored it. From then on every vello strip
— the 4 px tall partial-coverage tiles around glyph edges — overwrote the
pixels below instead of blending: the black fill vanished in those tiles.
Load-dependent because it depends on whether a pass ran before the raster.

Fix: `gl_state::isolated` saves the caps a pass switches off and restores them
after. Both passes use it. Not a vello raster-rung, tile or premultiply issue:
those were the first suspects and were ruled out once the headless repro showed
the holes follow vello_hybrid's strip grid.

Measured (Playwright headless, dpr 2, canvas-grey pixels inside the black
stack): 3088 before, 26 after (dots at the edge). Screenshots:
`~/Documents/feega-videos/editor-modes/blocky-{before,after}-*.png`.

Test: `packages/gpu-core/tests/gl_state.rs` (helper; the GL path itself only
runs in a browser).
