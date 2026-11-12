# Canvas: frame labels are shaped once, then scaled

A frame's label and kind icon keep a constant screen size, so their world size changes with the
zoom. They were re-shaped (`glyphs(text, size * k)`) and every contour point was shifted and
scaled in JS on every frame of a zoom, for every frame on the canvas. A profile of a zoom on the
heavy canvas put 326 ms of 4 s of main thread in those two point loops.

The label is now shaped once at the base size, cached per glyph set and text, and placed with
the item's matrix (scale and translate). Truncation compares against the room in unshaped units,
so the ellipsis cut also comes from the cache.
