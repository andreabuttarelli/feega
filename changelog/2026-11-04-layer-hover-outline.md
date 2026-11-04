# Layers-panel hover outlines the layer on the GPU canvas

- **Symptom.** Hovering a row in the Layers panel drew nothing on a GPU-painted frame, or (on
  DOM-painted frames, `FrameHover` + `PartsProbe`) a box measured by the HTML layout, a line off.
- **Cause.** The GPU overlay only drew `pickHover`, set by the canvas pointer. A row hover set
  `layersSource.hovered` and no overlay inside the frame read it.
- **Fix.** `layerHoverMark` turns the hovered row into a quad from the frame picker — the same
  typeset placements selection uses — and `GpuFlow` draws it as `frame-layer-hover-box`.
- **Test.** `layer-hover-mark.test.ts`.
- **Not fixed here.** Stack resize clipping, text clipped at a stale stack edge and the
  drop-indicator offset did not reproduce locally on a seeded frame or canvas Stack.
