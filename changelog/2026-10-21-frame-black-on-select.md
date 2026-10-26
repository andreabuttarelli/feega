# Selecting a frame no longer turns it black

With `unifiedFrames` on, selection still put frames into `editableIds`, so
the selected frame mounted its DOM tile (MotionNode) on top of the core
drawing. Since #1078 that tile no longer swaps to the player, so it showed
an empty black stage. `editableIds` now skips frames the core draws: under
`unifiedFrames` selection never changes who draws a frame.

`FrameHover` (the old DOM hover preview) is also off when core frames are
picked, so only the pick outline shows on hover — it was the second,
offset highlight.
