# Code mode shows the selection, not the page

Selecting a layer in Code mode still showed the component of the whole frame.

`selectionDoc` (`packages/motion-core/src/motion/codegen/selection.ts`) cuts a doc down to the
selected layers and their descendants: nested selections collapse to the topmost, the union
box becomes the doc size at 0,0, kept roots are detached from their parent at their world box
(auto layout resolved first), descendants and unit-relative props (`size`, stroke width) are
rescaled to the new size, and only the comps and assets those clips use stay. `selected` adds
the export name: the layer's name, or `<frame> Selection` for several. No selection returns the
doc untouched.

Not handled: rotation or scale of an ancestor is flattened into the root's bounding box;
keyframes are not rescaled; breakpoints are dropped from the cut doc.
