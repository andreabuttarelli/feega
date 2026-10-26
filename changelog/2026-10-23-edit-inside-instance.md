# Editing inside an instance on the canvas

Double-clicking into an instance selected its inner element, but every drag and Properties edit
went through `viewOf`/`mergeView` and rewrote the main component, so all instances moved.

- `instance-view.ts` is the one seam: `scopeView` shows the instance (main + overrides),
  `mergeScope` diffs the edited view against the main and writes only the differences as
  `overrides` on the host. An element dragged back to the main value stops being an override.
- `frame-scope.ts` (`scopeOf`, `scoped`) and the inspector (`inspectorOf`, `FrameInspectorPanel`)
  use it, so canvas drags, keyboard nudges and Properties all record overrides. A plain group
  (not a component) still edits its own comp.
- `transform` joins `hidden` and `effects` as a clip-level override (a drag writes the transform).
- "Open" on the instance still enters the main component and edits it for everyone.
- Not done: adding or deleting elements inside an instance (ignored, as in Figma).
