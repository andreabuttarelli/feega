# New free text keeps every line after commit

A drag-made (auto height) free text that wrapped while typing showed, after
commit, only its first line stretched over the grown node. The autosize grew
the node and posted `frameSize` (Constrained), which refit the doc on the
server with the frame rule (clip moved to x:1) while the client saver kept the
old doc: the core drew the old picture into the new box.

Now `textAutosize` for an element also returns the fitted doc
(`ResizeMode.Element`: keep the type size, clip fills the node). GpuFlow
amends its saver with it and stores only the node size (`onPlace`). One
writer for the doc, no server refit.

Click-made text was already auto width and grew with each keystroke. The e2e
`canvas-new-text-typing.spec.ts` checks it after every keystroke at zoom 1 and
2, and checks that the drag case shows the editor's line count on the canvas
after deselect.
