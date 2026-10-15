# Generated output on the empty canvas is a free element

`placeOutput` with a canvas drop used `landOnCanvas` (a frame with bar and brand background). It
now uses `landFree`: a chromeless element frame, transparent doc, the output's clip (`Image`,
`Video` or `Text`, from `mediaElement`) filling it. Size: the output's aspect at 320 canvas units
on the long side (`outputStage`); text uses the 1080² text sheet, so 320×320.

Video: the element model supports it as is — a `Video` clip in a video-mode doc; it plays when the
element is opened and posters at frame 0 like any frame. Image: the `Image` clip (contain, image
fill), the same component a frame uses for a placed picture.
