# gpu-core on WebGL2 draws layers too: blur, masks, mattes, effects, backdrop

The WebGL2 path (`?engine=gpu-core-gl`) skipped every item that needs an offscreen layer: those
were WebGPU compute passes. Now:

- The layer rules (which items get a layer, how big, in what order filters, blur and masks
  apply, how a backdrop is cut out) live once in `layers.rs` behind a `Surface` port; the
  WebGPU engine and the WebGL2 core both implement it.
- The filter graph runs behind a `Runner` port with two implementations: the compute passes
  (`filter_passes.rs`) and GLSL ES 3.0 fragment-shader passes (`gl_passes.rs`), one shader per
  op with the same parameters, read from a float texture. Layer blur, mask fold and mask apply
  are ops in the same graph, so the separate pass set is gone.
- On WebGL2 an item is rasterised by the sparse-strip renderer into the canvas, copied into a
  texture (flipped to top-down rows), processed, and uploaded to the renderer's image atlas as
  a picture. Pictures are uploaded premultiplied.

Parity on WebGL2 (Chromium, ANGLE/Metal), 4 frames, vs the HTML engine:

| Kind | before (skipped) | now |
|---|---|---|
| masks | 0.7365 | 0.9982 |
| mattes | — | 0.9987 |
| blur | — | 0.9996 |
| transitions | 0.9698 | 0.9963 |
| effects | — | 0.9971 |
| noise | — | 0.9964 |
| backdrop | — | 0.9984 |
| video | 0.9622 | 1.0000 |

Shapes, images, blends and strokes are unchanged. wasm: 3.24 MB, 760 KB gzipped.
