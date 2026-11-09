# Frame poster from the canvas thumbnail

The GPU canvas took a webp thumbnail of every drawn frame (#1864) but kept
it in IndexedDB only, so a cold open on another browser had nothing to
show until the frame was fetched and built. Posters were uploaded only by
the old DOM `MotionNode`. Now, when CoreFrames grabs the thumbnail of a
saved revision (no live edit) whose `posterRevision` is behind, GpuFlow
uploads it through the existing `poster` page action (webp accepted since
#1869), debounced 2.5 s per frame, last revision wins, at least 240 px a
side. Cold opens already draw a fresh poster card (`posterFresh`) until
the frame is built.
