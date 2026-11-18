# Canvas: a stack reflows while one of its children is dragged

Dragging a child inside an auto layout moved only the child: the siblings stayed where they were
and the slot it left stayed empty until the drop, so on a long page it was hard to tell where it
would land. `holdInStack` (`stack-drag.ts`) now shows the doc the drop would commit, laid out by the
stack itself (`reorderChild` / `join`, then `withAutoLayout`), with the dragged child shifted so it
stays under the pointer. The stack is laid out again only when the landing slot changes; the drop
commits the same reorder as before, one undo step. Leaving the stack still drags the child freely.

A pointermove without a button held is now ignored during an element drag: Chrome sends one from
the cursor's real position on repaint, and it dropped a held child out of its stack.

No regression was found for "the drag and drop indicators are gone": on dev and on a 2026-11-08
build, five seeded stack shapes reorder by drag with the drop line shown and undo restoring the
order (`canvas-stack-drag-reorder.spec.ts`). What does break a drag: drilling down with a double
click, which edits the child (text caret, vector points) instead of selecting it; single clicks
drill one level each. That behaves the same on the 2026-11-08 build.

Not done: the reflow is not animated; on a long imported page each pointer move still rebuilds the
frame (~100 ms a move on the landings fixture), so the drag runs at about 10 fps there.
