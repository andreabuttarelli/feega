# Outline view

⌘Y covers the frame with a blank sheet and draws every visible layer at the
playhead as a thin line: a Shape as its real outline (`baseOutline` through
`pathSpace`, the path booleans use), any other layer as its measured box quad.
Selection and handles stay on top, so editing keeps working.

It is an overlay child of `MotionPreview`, not a change to compose: the HTML and
the GPU engine are both covered without touching either renderer, and no export
can pick it up. View state, not saved (parity VIEW).
