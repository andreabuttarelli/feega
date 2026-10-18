# GPU canvas: the frame stand-in reports "drawn" on a box that has a size

The GPU stand-in of a frame marked itself drawn on an empty 0x0 child,
so anything asking whether the frame is visible got "hidden" even when
the GPU had painted it: `canvas-motion-open` failed on GPU iPhone before
it reached the tap. The marker now sits on the stage element, which
spans the frame. The reported "tap lands on FrameHover" did not
reproduce on current dev: with the marker fixed, a tap selects, drags
and opens the frame on GPU iPhone.
