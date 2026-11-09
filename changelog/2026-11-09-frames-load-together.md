# Frames fill in together on open

**Before:** `load()` in `CoreFrames.svelte` held one of the 6 `IN_FLIGHT` slots
until `media.ready` had downloaded and decoded every image of the frame.
Image-heavy frames kept the slots busy, so frames past the sixth waited for
earlier frames' images, and each frame stayed empty (all-or-nothing) until its
last image landed.

**Now:** `showStaged` (`src/lib/canvas/core/staged-show.ts`) shows the vector
content at once (images as placeholders) and swaps in images when ready; the
slot is released after the build, not after images. A frame with a thumbnail on
screen keeps it until images are ready.

**Not done here:** per-frame waterfall instrumentation, A/B bench, video.
Tile scheduling (perf/tiles-atomic) untouched.
