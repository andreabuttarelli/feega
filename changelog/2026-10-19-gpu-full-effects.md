# gpu-full runs the clip effects as a GPU filter graph

Step 4 of the gpu-full roadmap (ADR 0019). Instead of porting the 19 effects one by one, gpu-full
interprets what the effect registry already emits for the HTML engine: CSS filter functions
(`brightness`, `contrast`, `saturate`, `hue-rotate`, `grayscale`, `blur`, `drop-shadow`) and SVG
filter primitives (`feColorMatrix`, `feComponentTransfer`, `feGaussianBlur`, `feOffset`,
`feFlood`, `feComposite`, `feMerge`, `feMorphology`, `feDropShadow`, `feBlend`,
`feDiffuseLighting`, `feTurbulence`, `feTile`, `feDisplacementMap`). An effect edited in the
registry changes both engines; a primitive with no GPU pass is named unsupported.

- `filters.ts`: CSS function parsing, the W3C colour matrices, table interpolation.
- `filters-gpu.ts`: one pass per primitive on premultiplied textures, named results, px values
  scaled by the clip's world transform.
- `turbulence.ts`: the lattice and gradients of the SVG turbulence algorithm, seeded as the spec
  does; the noise itself is evaluated in a shader (grain and wave).
- Background blur blurs the frame behind the layer before it is drawn.
- `gl-kit.ts`: shared shaders and GL helpers, moved out of `raster.ts`.

| Kind | mean SSIM | worst |
|---|---|---|
| effects (15 effects on gradient stars over a picture) | 0.9969 | 0.9969 |
| backdrop (background blur under a glass rect) | 0.9995 | 0.9995 |
| noise (grain + wave on pictures) | 0.9326 | 0.9313 — wave matches to the sub-pixel; grain differs per pixel |

LUT runs through the same path (matrix + tables) but has no parity kind yet: it needs a `.cube`.
