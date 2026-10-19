# gpu-core crops layers to the item

Layered items (blur, masks, mattes, backdrop) rendered into full-frame textures, each copied
into vello's image atlas. Now the layer, its mask covers and the backdrop's under-image cover only
the item's bounds (`scene::bounds`, transformed points or the image's visible rect) grown by
3σ + 2 px of blur and feather. Effects keep the full frame: offsets, turbulence and tiles reach
outside the item.

Native render on Metal, 1920×1080, 20 frames incl. readback and PNG encode, ms/frame:

| Kind | before | after |
|---|---|---|
| masks (8 layered items) | 263.0 | 86.5 |
| effects (16, full frame) | 126.0 | 102.5 |
| backdrop | 53.5 | 46.5 |
| blur | 37.4 | 35.9 |

Parity unchanged (WebGPU, 4 frames, core vs HTML; TS on the same frames in brackets): masks
0.9981 (0.9981), mattes 0.9986 (0.9983), blur 0.9996 (0.9995), transitions 0.9963 (0.9959),
backdrop 0.9984 (0.9984).

Corner radius on pictures was planned with this: Image, Video and Logo have no radius prop in the
doc or the HTML engine, so there is nothing to match; only the bento layout has one.
