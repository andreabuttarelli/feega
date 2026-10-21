# Selecting a frame no longer reloads it

On the core canvas `selected` fed `editIds`, so a selected frame mounted a DOM tile; once painted the core hid
its own drawing, and on deselect the DOM unmounted and the core redrew from nothing (black, then elements).

`editableIds` (`frame-live.ts`) now leaves frames out of the DOM set when the core is on. The child-select
overlay from the previous change already covers stand-in tiles, so nothing is lost.
