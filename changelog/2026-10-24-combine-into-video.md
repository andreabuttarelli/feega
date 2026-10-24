# Combine into video

"Combine into video" on two or more selected frames creates a parent
frame below them whose timeline plays the frames left to right, each as a
scene clip that references the original node (`combineScenes` in
src/lib/server/motion/combine-scenes.ts; page action `combineScenes`,
canvas op `combine_scenes` for MCP/chat).

The canvas draws the parent with its scenes resolved (CoreFrames loads
scene sources; a parent's draw key carries its scenes' revisions, so a
saved scene edit redraws it). The export dialog resolves scenes too, so
MP4/GIF/Lottie export the whole sequence. The stored parent still holds
only references.

Verified by tests/e2e/canvas-scenes.spec.ts: three frames → combine →
browser MP4 export of 135 frames playing one, two, three.

Not yet: reorder/trim/transitions UI, drag a frame into a frame, Insert
frame, live (unsaved) scene edits, share/embed server paths.
