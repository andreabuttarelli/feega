# gpu-core runs clip effects as a GPU filter graph

The effects interpreter of the TS backend (`gpu-full/filters-gpu.ts`) is ported to the Rust core:
`filters.rs` walks CSS filter functions (brightness, contrast, grayscale, saturate, hue-rotate,
blur, drop-shadow) and SVG primitives (colour matrix, component transfer, gaussian blur, offset,
flood, composite, merge, morphology, drop shadow, blend, diffuse lighting, turbulence, tile,
displacement map) and runs each as a compute pass (`filter_passes.rs`). An item with effects is a
layer: effects first, then blur, then masks, as in the TS backend. The turbulence lattice and the
CSS colour parser are ported with tests pinned to the TS output.

Parity on WebGPU (Chromium, Metal), 4 frames, both backends vs the HTML engine:

| Kind | TS WebGL2 SSIM | core SSIM |
|---|---|---|
| effects (16 effects) | 0.9969 | 0.9971 |
| noise (grain, wave) | 0.9326 | 0.9332 |

Noise sits at 0.93 on both backends: the gap is shared, not the port's. Backdrop blur is still
skipped by the core.
