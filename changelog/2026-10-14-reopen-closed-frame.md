# A frame closed with ✕ opens again on the next click

Closing a frame's inline editor sets `dismissedMotion` to that frame while it stays selected;
the dismissal only cleared on a selection change. Clicking the same frame again changed nothing,
so it never reopened (0/2 reopens in the probe; it took a click elsewhere first). A click on a
node now clears the dismissal of that node (`dismissedAfterClick`), wired from CanvasFlow's node
click.
