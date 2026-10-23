# Scale tool reaches effects

`scale-tool.ts` scaled box, text size and strokes but left effect radii alone, so a 2x scaled
layer kept its 10 px shadow. A table (`PIXEL_PARAMS`) now names the pixel-sized params per effect
kind; `scaleClips` multiplies them and clamps to the param's range. Colour grading params are
not pixel sizes and stay untouched.
