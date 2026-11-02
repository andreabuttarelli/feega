# Entering Motion always opens the timeline

#1536 remembered ⌘J visibility per mode, so a timeline closed once stayed closed on the
next Motion entry. `EditorModeState.set` now reopens Motion's timeline on every entry; ⌘J
still hides it until the next one.

With nothing selected, entering Motion selects the first frame on the canvas so the
timeline has a frame to show. Test: `entering Motion reopens the timeline after it was hidden`.

Not changed: no empty-state text when the canvas has no frame.
