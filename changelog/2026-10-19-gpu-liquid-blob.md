# Liquid blobs draw on the GPU

LiquidBlob had no painter in the display list, so every frame with one
fell back to its poster (7 of 57 on the heavy canvas copy).

It is now a `lens` item: the blob's pose at the frame (from `blobRows`,
memoised per clip because the jelly strain is a running sum over the clip)
plus the clip's local time and seed. Each renderer paints the items below
it into a frame-sized texture and runs the refraction shader over it:

- core (WGSL + GLSL for core-gl): `Op::Lens` in the filter passes, the
  texture built in `layers.rs` next to the backdrop layer, placed in
  `build_into` like a backdrop;
- gpu-full WebGL2: compiles `BLOB_FRAGMENT` from `hyperframes/blob.ts`
  itself, so the TS backend and the HTML engine run the same shader.

Like the HTML engine, the content excludes the frame background: where
nothing is drawn under the blob, the glass shows black in both. Kept on
purpose for parity; changing it means changing `blob.ts` too.

Known gap: the caustic light under the blob can exceed its shade alpha;
the core stores straight colour, so that extra light is clipped.
