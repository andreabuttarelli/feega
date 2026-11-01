# Layers range select, align to parent

- `pickFor`: Shift was a toggle like Cmd. Now Shift → `Pick.Range` (anchor = last picked, rows of the same scope from the visible list), Cmd/Ctrl → toggle.
- Right-bar Alignment section did nothing: `FrameInspectorPanel` never passed `onalign` to `MotionInspector`. Wired to `alignPicks`.
- `alignSpace` with one clip aligned to the whole doc. Now a stack flow child gets `layoutItem.alignSelf` on the cross axis (main axis refused); any other parented clip aligns to its parent's bounds; a root clip still to the frame.
- Inside a frame, ⌥ align shortcuts and the canvas align menu acted on canvas tiles (only the frame selected, so nothing). `GpuFlow.alignPicks` aligns the frame picks first; the element context menu lists the align actions.
- Multi-align math (union bounds) was already Figma-like; now covered by a test.
