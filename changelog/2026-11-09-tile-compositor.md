# Tile compositor behind `?coreTiles`

ADR 0034 step 1. With `?coreTiles` the GPU core caches the canvas as 256 px tiles per quarter-
octave zoom step (`src/tiles.rs` in gpu-core) and, during a gesture, only composites the sharpest
tiles it holds, falling back to coarser or finer steps — never a blank. Missing tiles raster on a
4 ms per-frame budget, nearest the centre first; tiles that would be blank raster at once, covered
ones refine every 120 ms. Each tile has a 2 px gutter so linear sampling shows no seams. At rest,
once every visible tile is held, the core switches to the exact full-screen raster, so the
picture at rest is never a scaled tile. Damage invalidates the tiles it touches, including damage
consumed by exact frames (`Compositor::take_damage`).

Gotcha paid for: the reprojector writes its uniforms through `queue.write_buffer` into a ring of
4 slots; drawing many tiles in one command encoder made all draws read the last values (nothing
on screen). Each tile draw now submits its own encoder.

Without the flag nothing changes. Next: batched tile renders, drag reuse, default on.

Second gotcha: the reprojector pipelines had no blending, so the overlay (selection, handles)
drawn last over the tiles replaced the whole screen with its mostly transparent texture: a full
blank whenever an overlay existed, not tile eviction as first suspected. The overlay now draws
with `Output::Over` (premultiplied source-over, target loaded).
