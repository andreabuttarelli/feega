# Free elements showed black

Reported: a fully red generated image, placed on the canvas, showed as a black square with a white
dot. Three causes, each reproduced by a pixel assertion in `tests/e2e/canvas-output-pixels.spec.ts`
before the fix (red 400×300 and 1×1 image, red video, text; closed, reloaded and opened):

1. **Black backdrop.** `<hyperframes-player>` paints `:host { background: #000 }`, and so did
   `MotionPreview .stage` and the hosted editor stage. Transparent docs (every free element)
   showed black wherever their clip did not cover. Now `MotionPreview` takes `background` and
   clears all three for `Background.Transparent`.
2. **Tiny doc.** The doc was sized from the source pixels (`frameOf` × `element.size`), so a 1×1
   output made a 16×16 doc. `atCanvasPixels` raises it to the element's canvas box at 2× when the
   source is smaller; larger sources keep their resolution. The white dot was the selection
   handle on that tiny picture.
3. **Invisible text.** The still sat on frame 0, where Text's entrance starts at opacity 0, and its
   colour was `brand.text` (light, meant for a dark video). `canvasReady` (draw-create) puts the
   still at the clip's settled end and inks `brand.text` as `#111111`, for drawn text and placed
   outputs. A clip dragged out of a frame keeps its own still frame (`StillAt.Kept`).

Not a media-resolution problem: the image clip's asset id resolved correctly in both states.
