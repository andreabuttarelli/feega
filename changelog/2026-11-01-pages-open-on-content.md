# Pages open on their content

Before: the first fit ran as a 250 ms animation from the origin, and was
never redone when switching pages, so a page could open on empty space.
The saved `canvases.viewport` was loaded but unused.

Now: `restoreViewport(saved, bounds, screen)` decides. A saved view per
user and canvas (localStorage) is kept only if it shows part of the
content; otherwise zoom-to-fit (padding, max 100%); empty page centres on
the origin. Applied instantly from the loaded tiles, on every canvas
switch. `?frame=` and go-to-main focus runs after and wins.

Discarded: server-side `saveViewport`, since it needs a write per pan.
