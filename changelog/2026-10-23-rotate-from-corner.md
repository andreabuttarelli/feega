# Rotate from just outside a corner

Rotating meant finding a round knob 28px above the selection, drawn twice (a DOM button and a
core-drawn circle). Figma has no knob: you reach just past a corner and the cursor turns into a
curved arrow.

- Every selected element, group and rotatable tile has an invisible zone outside each corner
  (`ROTATE_REACH_PX`, 22 screen px quarter disc, any zoom). Corner resize handles keep priority;
  the zone starts where the handle ends.
- The cursor is a custom SVG (`rotateCursor` in `resize-cursor.ts`), turned to point away from the
  corner and following the object's rotation, with `grab` as fallback. Cursors are cached per degree.
- Elements inside frames, group boxes and multi-selections already had four `data-rotate` targets
  (#1100); they are now the same quarter-disc zones with the oriented cursor.
- Free elements and group tiles take the new `HitKind.Rotate` / `GestureKind.Rotate` in `GpuFlow`:
  `rotateZoneAt` in `gesture.ts` finds the corner (undoing the object's own rotation), the drag
  turns about the centre and shows live; Shift snaps the angle to 15 degrees. A group's members
  still turn on release, as before.
- Removed: the DOM `rotate-handle` button and the core-drawn knob (`rotateItems`).
- Specs that grabbed the knob (`canvas-group-rotate`, `canvas-group-polish`, `canvas-free-box-fluid`,
  `canvas-resize-live`, `fluidity-scorecard`) grab the corner zone instead. New:
  `canvas-rotate-corner.spec.ts` (cursor at every corner, turn by 25/40 degrees at zoom 1 and 2, on a
  pre-rotated element and in a turned frame, Shift snap).

Not done: the floating selection toolbar can sit over the top corners' zones.
`canvas-group-rotate` and `canvas-group-polish` already failed on dev at later steps (frame poster,
editor opening); the rotation step of group-rotate passes.
