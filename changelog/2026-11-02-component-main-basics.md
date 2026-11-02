# Component mains: name, size, Go to main, undo of a resize

From the basics audit (items 21, 23, 24, 25, 26).

**Name (25).** ⌥⌘K always named the main "Component N". `componentName` now takes the
name the canvas shows for a whole free element (its tile name, passed by GpuFlow as
`layer`), else the clip's own name, else its kind label; "Component N" stays only for a
multi-selection.

**Size (25).** The main landed on the Components page at doc size, which for a free
element is twice its tile (the element doc is drawn at 2×). `homeComponents` now scales
the set it places by the source's stage-to-doc ratio, so the main shows at the size the
source had on the canvas.

**Go to main (26).** It ended in `zoomToSelection`, which fits the main up to 400%. A
new focus mode, `FocusMode.Pick`, selects and centres at the current zoom; the behaviour
of every mode is one row in `FOCUS` (`free-area.ts`) instead of comparisons in GpuFlow.

**Main resize (23).** Two "+" showed under a picked main: the component set outline's and
the instance variant plus. The variant plus is now left to the set on the Components
page. Undo of a resize did not restore: the PR before replayed `resize()` towards the old
box, and the set's refit is not invertible. The resize entry now keeps the undo entries
its inner writes produced (`undoStack.collect`) and undoes those, then puts the box back
as it was; undo and redo share one `reverse(entry, Way)`. A resize that lands where it
started with no inner change pushes nothing.

Not changed: a handle on a picked main still resizes the whole set tile (a main inside
its set grows by slightly less than the drag, because the set keeps its padding).
Resizing the main's comp itself needs a comp-resize op that does not exist yet.

**21 and 24 did not reproduce on current dev.** Flip of an instance of a text mirrors it
(the audit used a plain rectangle, which looks the same flipped); undo of a rotate
restores the 120×80 box.
