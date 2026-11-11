# Dragging a frame no longer lays out its responsive views again

`heldViews` keyed its cache on the frame box, so every pointer move of a frame with tablet and
phone views ran `resolveView` (a full auto-layout of the page at that width) for each view. On
imported landing pages that was most of the main thread during a frame drag.

The resolved view doc is now memoised per doc and breakpoint (`resolvedOnce`, a WeakMap on the
doc); a move only recomputes the view boxes. A new revision still produces a new doc and a new
layout.
