# Edge handles, axis lock and snapping on a selection

#1019 only had proportional corner grips.

- All eight handles scale the selection box. Edge handles stretch one axis, corners both;
  Shift on a corner keeps the ratio, Alt grows from the centre (`resizeFactors`,
  `scaleAroundXY`).
- The pulled handle snaps to the frame and non-member siblings (`snappedHandle`), only on the
  axes the handle moves.
- Shift while dragging a selection locks the move to the dominant axis.
- `arrange_space` `scale_group` takes an optional `factor_y`.

Rotated members do not stay exact under different x/y factors (scaleX/scaleY are applied in
their own frame); deliberately skipped.
Tests: `group-transform.test.ts`, `motion-group-tools.test.ts`.
