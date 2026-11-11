# Tiled canvas: the exact picture at rest is built in blocks

With `?coreTiles` the canvas switched, at the first still frame, to the full-screen exact
raster: one 250–690 ms frame on the main thread, hit again at every pause inside a gesture (fit
toggles, wheel pauses). Now the tiled path never leaves: 200 ms after the last move it rasters the
exact picture in 256 px screen blocks, nearest the centre first, inside the still-frame budget,
and draws each over the tiles as it lands. Damage or a camera change drops the blocks.

A/B landings, CPU 1x, 5 interleaved, flag on, dev vs this: zoom 46→57 fps, p95 33→18.7 ms, worst
617→68 ms; fit 46→56 fps, worst up to 800→52 ms, p95 unchanged at 33; time to sharp 2.0→2.6 s
(worse). Profile: vello per-render setup (`writeTexture`, `createBindGroup`) dominates each block.

Discarded: holding only the moving frames on a tiled canvas plus keeping the selection warm. A/B
showed drag p95 18→50–66 ms and no gain on the drag-start stall, which is the overlay rastering
every visible frame as a texture at once.
