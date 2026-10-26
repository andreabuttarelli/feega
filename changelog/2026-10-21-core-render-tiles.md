# Core: the sharp refine is rendered in tiles of at most 1024 px

User report: after zooming into a large frame the area covered by the viewport comes out fully
transparent (dot grid), the rest of the frame is fine after a pan; `outcome=full`, nothing
undrawn, no errors. The refine at rest was one vello render of the whole retained texture
(`GpuPainter::tile()` returned the adapter's max texture size, 16384, so a 2820x2412 retained
texture was a single render). A dense scene at that size is the likely way vello fails silently
(vello 0.11 only checks its bump allocators with `debug_layers`), which also matches "strips
outside are fine": strips are small renders.

`render_tile` (compositor.rs) caps a render at 1024x1024 device px; the compositor already splits a
raster into `tile()`-sized parts, each with its own plan and its own vello render, so per-render
complexity stays small. Test: a 2400x2000 viewport is painted as 9 tiles, none above 1024 px.

Not done: validating a tile after rendering (needs a GPU readback) and vello buffer-size
overrides (not configurable in 0.11). This is a mitigation of the most likely cause, not a
confirmed root cause; `coreDebug` is still the way to see the state at the blank moment.
