# On-canvas crop mode

Crop existed as three numbers in Properties. Figma crops on the picture itself: the box stays,
the picture moves and scales under it, Enter applies.

- `canvas/crop-handles.ts` holds the maths, `CropHandles.svelte` the overlay, `GpuFlow.svelte` the
  wiring (same shape as the gradient handles: `cropMark`, `dragCrop`, `endCrop`).
- Start: double-click an element whose top visible fill is an image (text keeps typing), Enter on
  a selected one, or "Crop image" under the fill in Properties (`cropRequest`, a one-number store
  the canvas watches, so the inspector does not need to know the canvas).
- The mode starts from what the fill shows now (`windowOfFit`: cover, zoomed cover, stretched
  picture, or the stored window), so entering changes nothing visible.
- Drag inside to pan, drag a picture corner to scale around the opposite corner, wheel to zoom at
  the pointer. The window never leaves the picture and never gets thinner than `MIN_WINDOW`.
- Drags write the live doc only; Enter or Done commits one revision ("Cropped image"), Escape or
  Cancel puts the saved doc back. The picture outside the box is a dimmed `<img>` with the box
  cut out (`clip-path` even-odd), so the core's own drawing inside the box is not doubled.
- Checked in Chromium against the real canvas and export (`tests/e2e/image-crop.spec.ts`,
  screenshots `~/Documents/feega-videos/e2e/img-crop-*.png`): the saved window is stored on the
  fill and the export draws the same crop.
- Not done: an Image component (media clip) has no fills, so it has no crop; rotated elements
  show the handles on their axis-aligned box, as the gradient handles do.
