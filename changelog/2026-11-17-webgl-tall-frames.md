# Tall frames draw whole on the WebGL core

Play's `draw` path ignored the screen fit: a frame taller than the
device side (landing, 1440x4632) got a canvas fitted to 3840 but was
painted at 1:1, so it came out cropped and enlarged. Both cores now
wrap the list in a scaled `use` of a library group (`fitted_list`), so
the planner scales matrices, blur and scissors like a camera zoom.
Discarded: a `by` transform on the surface — offscreen layers stayed in
list coords and the dashboard card was clipped.

Still open: the phone view (scale 0.6) clips one shadowed card at its
right edge, and the parity spec cannot reach 0.98 on landing because the
canvas shot of a zoomed-out 4632px frame is a ~300px blur.
