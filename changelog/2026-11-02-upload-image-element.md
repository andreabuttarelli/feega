# An uploaded picture is an image element

Basics audit item 5. "Upload file" from the bottom bar (and a picture dropped on the empty
canvas) went through `registerCanvasUpload`, which makes an `image` node: the same tile as
Generate image, with its prompt bar and no rotate, flip or copy of a drawn layer.

Now `upload` in the canvas page sends every picture the way a picture dropped on a frame
already went: storage first, then the `upload` action with a `drop`. The action accepts a
canvas drop too and calls `placeFreeMedia`, which lands the picture with `landFree` — the
same path a generated output dropped on the empty canvas takes — so the row is an `element`
node wrapping one `Image` clip. Copy/paste, rotate and flip are those of any free element.

The bar and the file drop now pass where the file goes (view centre, drop point); before
they passed nothing and the tile landed at 0,0. Videos, documents and other files still make
their own node through `registerCanvasUpload`.

Discarded: keeping the optimistic tile with upload progress for pictures. The element
appears when the row is back (same as a picture dropped on a frame).
