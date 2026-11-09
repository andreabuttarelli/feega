# Small curves flatten to fewer points

Every cubic in a shape outline was cut into 16 straight pieces whatever its
size (`CURVE_SAMPLES` in `shape/geometry.ts`). Linear's imported landing
has a 438-dot illustration with a stroke: each 3–7 px dot became 64
points, and the stroke bands turned that into one 84,096-contour path,
half of the frame's contour floats and two thirds of its native encode
time (32 → 11 ms without it).

`flattenPixels` picks the piece count per cubic from its bend (Wang's
formula) so chords stay within 0.03 px of the curve, never more than the
old 16. The display-list builder uses it for fills and strokes, whose
outlines are in frame pixels; `flatten` keeps its fixed 16 for the
unit-space callers (morph, boolean, modifiers, lengths).

Discarded: rasterising degenerate patterns into an image fill. It needs a
pixel check per zoom level and breaks sharpness when zoomed; the curves
were simply over-sampled.

Pixel diff vs dev at rest (landings, DPR 2): fit view 846 px differ, max
2/255; Linear dots at zoom 1 max 18; at zoom 4 the dot outlines differ by
up to 93/255 on anti-aliased edge pixels, visually identical side by side.
