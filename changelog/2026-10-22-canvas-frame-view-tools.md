# Corner, motion-path, outline, pixel-grid and guides on canvas frames

Part of the canvas/editor merge: these lived only in `MotionEditorShell`, which is going away.

- `CornerOverlay`, `MotionPathOverlay`, `OutlineOverlay`, `PixelGridOverlay` render inside
  `FrameTools`, gated by the existing `shownOverlays` registry (`frame-tools.ts`), which gained
  `Corners`, `MotionPath`, `Outlines` and a `views` context.
- View toggles are `FrameViews` (`canvas/frame-view.ts`), held by `GpuFlow`, flipped by the canvas
  shortcut `view` (⇧' ⇧G ⌘Y — same keys as the editor, resolved through `commandFor`).
- Corner and path drags read the pointer with `hostFraction` (`motion/host-point.ts`):
  `getBoundingClientRect` on a rotated frame is the axis-aligned box, so handles drifted.
- Outline boxes come from the frame picker's `frameRect`, only while outlines are on.
- The outline sheet sits at `z-index: -1` so selection boxes stay above it.
- `LayoutGuidesSection` shows in `FrameInspectorPanel` when nothing is picked.

Discarded: a separate `FrameEditOverlays` host — duplicated `FrameTools`' fit and registry, and
rendered the layout guides twice.
