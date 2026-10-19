# gpu-core on WebGL2 (`?engine=gpu-core-gl`), first increment

The core needed WebGPU; browsers without it had only the TS WebGL2 backend. The display list now
also draws through vello_hybrid's WebGL2 renderer (sparse strips, Apache-2.0/MIT): the frame
builder writes to a `Canvas` port with two adapters, vello (WebGPU, native) and vello_hybrid
(WebGL2), so both read the same list with the same rules. `WebGlCore` sits next to `WebCore` in
the same wasm; `?engine=gpu-core-gl` and `--under=gpu-core-gl` pick it.

Parity on WebGL2 (Chromium, ANGLE/Metal), 4 frames, vs the HTML engine:

| Kind | core on WebGL2 |
|---|---|
| background | 1.0000 |
| shapes | 0.9992 |
| gradients | 0.9984 |
| transforms | 0.9999 |
| opacity | 0.9998 |
| strokes | 0.9985 |
| blends | 0.9973 |
| images | 0.9979 |
| zoom | 0.9994 |
| moves | 0.9978 |
| video | 0.9622 |
| transitions | 0.9698 (blur skipped) |
| masks | 0.7365 (skipped) |

Not on WebGL2 yet: anything that needs a layer — blur, masks, mattes, effects, backdrop. They
are compute passes on WebGPU; WebGL2 has no compute, so they need fragment-shader versions (or
vello_hybrid's own blur/drop-shadow filter layers, which cover a fraction). Skipped items are
reported, not drawn wrong. Cost: the wasm grows from 2.37 MB to 3.18 MB (748 KB gzipped).
