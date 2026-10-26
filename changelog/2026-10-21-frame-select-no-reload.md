# Selecting a frame no longer reloads it

On the core canvas `selected` fed `editIds`, so a selected frame mounted a DOM tile; once painted the core hid
its own drawing, and on deselect the DOM unmounted and the core redrew from nothing (black, then elements).

`editableIds` (`frame-live.ts`) now leaves frames out of the DOM set when the core is on. The child-select
overlay from the previous change already covers stand-in tiles, so nothing is lost.

The frame stand-in is positioned after the hover overlay in the tile, so it covered `FrameHover` and the
pointer never reached it on unselected frames. `tileOver` now renders after the stand-in. While the pointer is on
one of a frame's elements the frame's own hover ring yields to it (`frameRinged`).

The frame stand-in is positioned after the hover overlay in the tile, so it covered `FrameHover` and the
pointer never reached it on unselected frames. `tileOver` now renders after the stand-in. While the pointer is on
one of a frame's elements the frame's own hover ring yields to it (`frameRinged`).
