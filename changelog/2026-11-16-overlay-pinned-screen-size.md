# Canvas: overlay chrome keeps its screen size at every zoom

#2213 held `strokeZoom`/`labelZoom` mid-gesture to stop resending the overlay, so rings, handles
and frame labels scaled with the camera until the gesture rested. #2248 patched the selected ring
by resending the selected part per stroke step.

Now a path item can carry `nudge`: per-vertex offsets in CSS px beside its world `contours`. The
core resolves `contour + nudge × pixelRatio / zoom` each time it builds the overlay or screen list
(`world.rs`, `pinned`), so the geometry is anchored to the frames and the chrome stays the same
size on screen in every presented frame. A part holding nudged items is drawn item by item instead
of as one group.

`pinned` in `chrome.ts` builds a tile's chrome twice (`perPx` 1 and 2) and takes the difference as
the nudge, so every builder stays written in plain world units. Labels are baked into contours
instead of a scale matrix for the same reason. The dashed editing ring keeps the held step: its
dash count changes with size. Cards draw their own labels in content groups and are unchanged.

The #2248 per-step resend of the selected part is gone: nothing in the overlay changes mid-gesture.
Label hit boxes still use the held step.
