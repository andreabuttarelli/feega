# Duplicating a stack child keeps it in the stack, on screen

⌘D on a Text inside a Stack added a second layer in the Layers panel that never showed on
the canvas, and the Stack kept its size. `duplicateClip` starts each copy where its
original ends (timeline semantics), so the copy lived after the playhead, outside the
frame's still.

`duplicateLayer` in `layout/ops.ts` now handles a stack child: same `from`, inserted right
after the original in `autoLayout.order`. Other clips keep the timeline behaviour. The
editor and the `duplicate_clip` agent tool share `runClipOp`, so both agree.

Guard: `ops.test.ts` "duplicating a stack child".
