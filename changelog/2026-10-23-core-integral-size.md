# Whole-pixel group sizes sent to the GPU core

The core deserializes a display list's `width`/`height` as `u32`.
A frame or element with a fractional size (live resize, auto-size
text) made `put_group` throw `invalid type: floating point ...,
expected u32` and the canvas stopped drawing. `core-web.ts` now rounds
the size up at the boundary.
