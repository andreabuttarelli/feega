# Frame: one bar, its own shape, its new name

**One top bar.** With a frame open, the editor's bar is laid into the middle of the canvas
top bar (`data-top-slot`, fixed over it every frame by `anchoredTo`), between the breadcrumb and
credits/share. `BAR_PLACE` (`editor-mount.ts`) is the one table: desktop and tablet use the
canvas bar, phone keeps the editor bar as the only row (the phone canvas bar hides). In the
slot the bar drops the title, frame steps and the publish button to fit.

**Shape.** `frameNodeSize(width, picture)` gives the node the doc's aspect plus the node bar.
The canvas fits the open frame to its doc whenever the doc's size changes (keeps the width), and
every resize of a frame node snaps its height to the picture. While editing, the node bar says
"Editing" instead of standing empty, and the player fills the picture area exactly. The add bar
counts as a bottom dock, so framing keeps the node clear of it.

**Name.** The node is labelled Frame (add bar, node, output port, Layers, editor title, chat
thread, MCP/CLI titles). The type stays `motion`, as do routes, tool names and the "Motion"
canvas found by name — renaming that would have created a second canvas for every user.

**Not done.** The brief old-text flash after an inline poster edit (the player reloads the
new composition): not cheap without a second player.
