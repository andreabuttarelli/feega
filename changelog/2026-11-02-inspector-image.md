# An image layer is styled like a rectangle

Props audit H10, L6. H9 left open (below).

- **H10.** `Image` had no radius, fill or stroke: the props schema refused them and both
  renderers drew a bare picture. The schema takes `roundness`/`corners`/`smoothing`
  (shared `rounding()` with Shape), `fills` and `strokes`. `image-dress.ts::imageRectangle`
  turns a dressed image into Shape rect props whose first fill is the picture; the GPU
  `imagePainter` and the HTML `Image` template draw it through the Shape path. An undressed
  image keeps the old picture path, so nothing already made changes. `FILLED`/`STROKED`
  list `Image`; `FAMILY_SECTIONS` gives it Fill and Stroke (Video unchanged).
- **L6.** `mediaElement` (a picture placed into a frame) now sets Left/Top constraints, as
  `addClip` does for every drawn layer — `newClip` had none, so the default Scale showed.
  It names the clip after the file (cut to 60). The asset label in the media picker was
  `image · date · id`; `uploadName` (shared with the media library) reads the file name of
  an upload. Crop X/Y and Zoom read in percent (`IN_PERCENT`, `LOOKS`).

Discarded: making a dropped picture a Shape with an image fill. Free image elements are
recognised as image sources by their single `Image` clip (`free-image.ts`), and agents and
templates make `Image` clips; extending `Image` keeps both.

**H9 not done.** A file dropped on the canvas becomes an `image` node by design
(`uploaded-node.ts`): it feeds generation edges as an image. Path: `GpuFlow.svelte::onDrop`
→ `props.onUpload` → `+page.svelte::upload` → `uploadOnCanvas` (optimistic `pendingPicture`)
→ action `upload` in `canvas-page.ts` → `registerCanvasUpload` → `nodes` row
`type: 'image'`, `data.assetId`. Making it an element node changes the node type the
upload action, the optimistic insert, asset/brand drags (`drag-payload.ts`) and
`/api/v1` uploads return — a product decision, not an inspector fix.
