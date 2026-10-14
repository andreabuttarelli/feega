# The bottom bar steps aside under a frame's dialogs

#530 put the canvas bar at `z-index: 61`, above the inline editor layer (60), so the bar would
take clicks over the frame stage. The editor's own dialogs (Export, templates, publish, sounds,
help) live inside that layer, so the bar sat on top of them: in the MP4 export dialog it covered
the start button.

`frameBar.covered` is set by the shell while any of its dialogs is open; the bar hides itself
(`visibility: hidden`) meanwhile. Detaching the editor clears the flag.
