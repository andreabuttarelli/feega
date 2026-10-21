# Core canvas: no black frame at the start of a zoom

At rest frames are drawn live (`cache:false`), so no texture exists. The first zoom turned caching on, and a frame with nothing held was shown as its half-built chunk texture. For vector frames without a background colour that texture is transparent until the last chunk lands: the frame read as black for several draws.

`Library::plan` now keeps drawing the frame live while its first texture builds. Once a texture is held, the stale one stays on screen scaled until the replacement completes (unchanged).

Discarded: reprojecting the retained screen only. It already covers the gesture; the hole was inside the per-frame cache, not the screen.
