# coreDebug: coverage of the canvas at gesture end

To separate "the refine rendered nothing" from "it was placed wrong" when a large frame goes blank
after a zoom: with `?coreDebug=1` the gesture-end line now also logs `coverage3x3` (share of
non-transparent pixels in each cell of a 3x3 grid, read back from the visible canvas in the same
task as the frame) and `camera` (the device-space camera sent to the core: x,y,zoom x DPR). A frame
that is drawn and opaque gives 1.00 in every cell; a viewport punched out gives ~0 in the cells it
covers while the log still says nothing is undrawn.

Audit done while chasing it, no bug found: the JS side sends every held frame's use without
culling (`worldUses`), `visibleIds` and the Rust `on_screen` test are intersection tests, and a
compositor test already plans a 1440x2800 frame at 2-4x with the viewport strictly inside it.
