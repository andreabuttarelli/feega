# Scale and rotate a multi-selection as one

The union box from #1013 had no handles. Now it has four corner scale grips and four rotate grips.

- `scaleAround` / `rotateAround` (`group-transform.ts`): every member's `scaleX`/`scaleY` (or
  `rotateZ`) changes by the same factor (angle) and its pivot swings around the box point;
  written through `patchEach` in `space.ts`, so Design shifts keyframed paths and Motion keys
  the frame, like every other op there. Each drag is one `onchange`, one undo step.
- Scale is always proportional (corner handles only): non-uniform scale of rotated members is
  not expressible with `scaleX/scaleY` alone. Alt scales from the box centre; Shift snaps
  rotation to 15 degrees.
- Parity: `arrange_space` gains `scale_group` (factor) and `rotate_group` (degrees), around the
  centre of the joint box. Existing `scale` (bakes size/text/stroke from the top-left) is
  unchanged.

Not done: edge handles (non-uniform), group snapping while scaling.
Tests: `group-transform.test.ts`, `motion-group-tools.test.ts`.
