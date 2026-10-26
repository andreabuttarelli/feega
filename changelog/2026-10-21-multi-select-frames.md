# Multi-select, frame undo, rotated chrome on core frames

Step 8 (a)-(c) of canvas-editor-unify. `picks` in GpuFlow holds the selected clip ids of the node being edited; the last one is primary. Shift-click toggles (`toggleId`), shift-drag on bare frame draws a marquee (`marqueeIds`). The session selection feeds MultiInspector and Layers. Dragging moves all picks by the same delta.

Cmd+Z / Shift+Cmd+Z undo in the frame session while it has history (`undoRoute`), otherwise fall to the canvas undo. FrameOverlays rotates with the frame, so chrome is drawn on rotated frames too.

Not done: (d) draw/pen/vector/mask/align tools in FrameOverlays; second PR.
