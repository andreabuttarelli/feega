# WebGL2 core composites blend modes itself

On WebGL2, a `multiply` layer inside a group wiped everything under it
in vello_hybrid: saturn-39cd5543 lost its paper and grid (SSIM 0.1486
on the content frame). Splitting blend and opacity into two hybrid
layers, or bounding the layer with a clip, changed nothing.

`layers::Blending::Composited` (used by `web_gl.rs`) paints what is
under a non-normal item and the item itself into two textures and runs
the existing filter `Blend` pass with the item's opacity, then places
the result as a normal picture. WebGPU and native keep vello's own
blend (`Blending::Native`). Inside a group the backdrop is the group's
earlier children: the group is isolated, as in CSS.

Guard: `tests/blending.rs` renders the same multiply both ways and
requires equal pixels.

| saturn-39cd5543, core WebGL2 vs HTML | mean | worst |
|---|---|---|
| before | 0.8581 | 0.1486 |
| after | 0.9991 | 0.9946 |
