# Drag elements out of frames and back in

Before: an element dropped on the empty canvas became a new frame (bar, brand background, stage
width of its format). Now `moveElement` lands it as a free element (`landFree`): node size =
its box in the source frame × the source stage in canvas units (`StoredFrame.stage`), centred on
the drop, transparent doc. A source with no known stage (the API without a frame row) keeps the
old frame landing.

Into a frame: dragging a free element's tile over a frame marks it (`onTileDragOver`) and the
drop posts `moveFree` → `moveFree` lifts the element's clip into the target. The element is
scaled to keep its on-screen size (`seenAt`: element size re-expressed in the target's pixels via
both stages). An emptied element is soft-deleted instead of written empty; the gesture undo is
`[doc.revision(target), node.delete(element)]`. Elements are not drop targets
(`frameChrome.takesDrops`).

Bug found on the way: undo of any `node.delete` was refused on the real stack with
`node_deleted_by_peer` — the precondition used `findNode`, which hides soft-deleted rows. Unit
tests were green because `fakeDb` ignores filters by default. Fixed with `nodeRowExists`; test
seeds `deleted_at` with `{ filter: true }`. Lesson in LESSONS.md.

`elementBox` (was private `defaultBox` in `motion/move-element.ts`) is now exported for the
server landing. Groups move only their first clip for now (PR 4).
