# Rotation origin handle

The pivot was only a number field. `FrameView.Pivot` (Alt+R, `Command.TogglePivot`, default off)
draws a handle at the clip's `anchorX/anchorY` on a single selected element; dragging it runs the
existing `Grip.Anchor` drag (`anchored` in `scene-select.ts`), which moves the origin without
moving the element, and later rotation turns around it. Rotating with Shift keeps its 15 degree
steps. MCP already sets the pivot through `set_transform` (parity row is a view toggle).
Browser check: `tests/e2e/canvas-pivot-handle.spec.ts`.
