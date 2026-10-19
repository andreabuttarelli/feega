# gpu-core draws blur, masks, mattes and wipes through offscreen layers

vello renders a whole scene in one compute pass and has no filters, so an item that needs blur, a
mask or a matte gets its own layer (ADR 0019): `Engine` renders the item alone into a texture,
runs compute passes on it (`passes.rs`: separable gaussian with the TS kernel, mask fold, mask
apply), registers the result with vello and draws it in the frame scene like a picture, inside
the item's blend and opacity layer. Mask covers (path, ramp, picture) and mattes are rendered the
same way and folded with the TS backend's rules (add, subtract, intersect, difference; level,
invert, luma). Wipes are a clip layer. Native and web share `Engine`.

Parity on WebGPU (Chromium, Metal), 6 frames, both backends vs the HTML engine:

| Kind | TS WebGL2 SSIM | core SSIM |
|---|---|---|
| blur (keyframed 0→24 px) | 0.9996 | 0.9997 |
| masks (8 kinds, feather, stack) | 0.9981 | 0.9981 |
| mattes (alpha, luma inverted) | 0.9983 | 0.9986 |
| transitions (incl. wipe, blur) | 0.9970 | 0.9974 |
| blends (regression) | 0.9971 | 0.9973 |

Cost: every layered item is a full-frame texture plus an atlas copy; cropping layers to item
bounds is the next optimisation. Still skipped by the core: effects (filters) and backdrop blur.
