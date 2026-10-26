# In-frame transform parity (workstream A of the Figma gap audit)

Before: elements inside a frame on the GPU canvas only moved and scaled.
`canvas/frame-transform.ts` passed `shift: false`, no snap targets and no
reach to `dragPatch`, and scaled several picks one by one in place.

Now:

- `dragClips` in `canvas/frame-transform.ts` drives every in-frame drag.
  One element goes through `scene-select.dragPatch` with Shift and snap
  targets (siblings + frame edges; reach = 6 screen px converted to frame px
  through the frame space, so it holds at any zoom and frame rotation).
  Several elements, or Alt-resize of one, go through `groupDrag`.
- `groupDrag` (`motion/element-gesture.ts`) is the editor's group
  move/scale/rotate lifted out of `SelectionOverlay.svelte` unchanged, so
  editor and canvas share one implementation.
- `FrameSelection` draws rotate targets outside the corners and has three
  kinds: element, member (outline only), group (dashed box with handles).
- `FrameGuides` draws guides, spacing and Alt-measure labels in frame px.
- Arrow nudge moves picked elements (`nudgeClips`); steps are now 1 / 10
  for tiles and elements, as in Figma.
- Flip H/V added to the clip bar and to `barAction`.

Known limit: a rotated element's selection is drawn as its axis-aligned
box, not a rotated quad.
