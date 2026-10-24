# Split an image into layers (F1, 3)

**Before:** no way to take a picture apart. Flora parity gap.

**Now:** `image_tool` gains `split_layers`. `startImageTool` asks a vision model for the
separable elements with boxes on a 0-1000 grid (`layer-detect.ts`, parsed by `layer-boxes.ts`),
refuses with `no_layers_found` before spending when it finds none, then runs kie
`seedream/5-flash-layer-decomposition` with a prompt naming each element and its `<bbox>`.
The node keeps the boxes (`layerBoxes`); the provider returns the base first, then one image per
layer, and `finishTaskJob` deposits the extras (`spec.layers`) which the reconciler writes as
`layerRefIds`. `layers_to_frame` (`layers-to-frame.ts`, pure builder `motion/layers-frame.ts`)
makes a still frame the size of the base with the layers as image elements at their boxes.
UI: `split-layers` and `layers-to-frame` selection actions -> page actions `imageTool` /
`layersToFrame` -> the same server functions as the edit ops.

**Decisions:** the provider returns layers cropped to their element with no coordinates, so
positions come from the boxes we asked for, not from the result. Layer N is assumed to be the
Nth element named in the prompt: unverified against a real call (one smoke call needed, kie
price is an estimate of 24 credits for base + 5 layers). No new column: `layerRefIds` and
`layerBoxes` are server-written node data.

**Also paid for here:** a duplicate `import Frame` passed vitest (esbuild tolerates it) and
blanked the whole canvas in the browser; only the e2e caught it.
