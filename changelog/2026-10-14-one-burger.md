# One burger while a frame is open

**Before.** With a frame open on the canvas the editor bar sits in the canvas top bar
(#485), and both carried a burger: the canvas menu and the editor's drawer.

**Now.** `menuPlace(mount, viewport)` (`editor-mount.ts`) decides where the editor's menu goes:
in the canvas bar (desktop, tablet) there is no drawer; its frame properties were already the
Properties panel's default view, and Template and Keyboard & gestures move into the bar's More
menu, shown at every width there. On a phone the editor bar is the only bar, so it keeps its
drawer. `propertiesFor` (`properties-view.ts`) is the one table of what Properties shows: the
frame when nothing inside is selected, the clip, or only a poster part's field.
