# Text and shortcut audit, groups and selection

From the round-2 text/shortcut audit, second batch.

- **No wrapper frame.** A free element is a node whose doc holds one clip. Esc from that clip
  climbed to the node and showed the frame inspector of the wrapper ("Text"/"Box", white fill,
  clip content). `leaveLevel` now leaves to the canvas when the next level is the wrapper of a
  `Root.Own` node.
- **Groups.** A canvas group (`FrameKind.Group`) showed the frame inspector, with the surface the
  panel adds to any doc. The chrome table gains `panel`, `enter` and `click`: a group shows
  `GroupInspector` (place, size, export), Enter picks its root clips (`enteredClips`), and a first
  click selects the group, not the member under the pointer; once inside, clicks pick members,
  ⌘-click still reaches the deepest one.
- **Enter on a clicked tile.** A clicked tile keeps focus, and its `role="button"` made
  `matchCanvasShortcut` leave Enter to it. Tiles carry `data-canvas-tile` and are not controls.
- **Panel after reload.** Node docs load in a queue that waits for idle time, one node at a time;
  a node clicked right after a reload had no doc, so no session and no right panel, for seconds.
  The selected nodes now fetch at once (`pickedToFetch`).
- **Rename field.** ⌘R opened the Layers rename field without focus, so Esc never reached it; the
  field now takes focus and selects its text.
- **R and ⇧R.** In Design, R is the rectangle and ⇧R the rulers, as in Figma; the toolbar
  tooltip and the help card said ⇧R for the rectangle. Tooltips read the keys of the current
  mode. Motion keeps ⇧T/⇧R/⇧O/⇧P, plain letters being timeline keys there.
