# Preview zoom and pan

The motion preview was fit-only. Now it has a view zoom (Fit, presets, 10%–800%) and pan.

- View only: `ZoomStage.svelte` holds a `View` (`scale | null` for Fit, `x`, `y`); doc and
  history are never touched. Math is pure in `src/lib/motion/preview-view.ts` (anchor-preserving
  zoom, pan clamped to the frame edge, preset steps).
- Zoom resizes the stage (`--preview-w`) instead of a CSS scale, so selection/mask/pen handles
  keep their pixel size at any zoom; pan is a translate.
- Gestures: ctrl/⌘+wheel and pinch anchor at cursor/fingers; plain wheel pans when zoomed;
  space+drag and middle-drag pan. Space over a zoomed preview is the hand; a space tap still
  plays. A two-finger pinch swallows its moves before the overlays, so it cannot drag a clip.
- Commands `PreviewZoomIn/Out/Fit/Actual` (⌘= ⌘- ⌘0 ⌘1) in the action table, View guide.
- Timeline divider: double-click resets the height; 44px hit + grip on coarse pointers. Still
  hidden on phone (fixed 34vh stage) — left for later.
