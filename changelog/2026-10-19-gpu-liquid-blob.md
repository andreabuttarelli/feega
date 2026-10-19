# LiquidBlob drawn by gpu-full and the core

Before: LiquidBlob was an unsupported component in gpu-full; 7 heavy-canvas frames fell back to
posters for it alone (gap histogram: 22 → 15 posters, 9 → 2 non-custom).

Now `drawFrame` emits a `blob` item in frame space (the HTML engine also ignores the clip's
transform): the baked pose row for the frame, local time and seed. Backends draw everything
below it into a texture and run the refraction shader over it:

- TS WebGL2 reuses `BLOB_FRAGMENT` from `hyperframes/blob.ts` on the resolved main target.
- gpu-core: `Op::Blob`, WGSL and GLSL ports in `src/blob.rs`; the item's matrix and its inverse
  ride in the params, so the canvas camera scales it.

Decision: what lies beneath includes the background colour (HTML samples only the clips below
the blob, black elsewhere). Equal wherever a background clip exists.

Parity (blob kind, Chromium/Metal, 4 frames): webgl2 0.9989, core 0.9992, core-gl 0.9992.
