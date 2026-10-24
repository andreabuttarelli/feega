# Sections: edit title and fill, drag to join or leave

**Before:** a section was created by Shift+S with a fixed title and fill; membership was only
set when wrapping. Selecting a section mounted its DOM tile (`EmptyNode`) over the whole card,
hiding the members.

**Now:** with one section selected the selection toolbar shows a title input and a colour
input (`write` on `data.title` / `data.fill`). Dropping a node inside a section sets
`data.groupId`; dragging it out clears it (`membershipAfter` in `canvas/section.ts`, called
from `moveEnd`). Sections are excluded from `editableIds` in `GpuFlow`, so the core card stays
the only drawing.

**Decisions:** element groups are never reassigned by a drag, a section never nests, and a
member moving with its own section keeps its membership. Membership writes have no undo entry
yet.

**Tests:** `section.test.ts` (membership rules), `canvas-section.spec.ts` (edit, drag out and
back in, against the real stack).
