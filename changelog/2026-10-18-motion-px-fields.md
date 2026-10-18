# Motion tools take and give px boxes

Agents building pages through `/api/v1/motion/<id>/tools` had to convert by hand: x/y are the
box centre, `roundness` a fraction of the short side, stroke widths a fraction of the frame's
short side.

- `add_clip`, `set_props`, `add_shape` accept `left`/`top` (top-left px), `radius` (px) and, per
  stroke, `width_px`/`dash_px`/`gap_px`. Converted in `src/lib/motion/px-fields.ts` before the
  existing unit layer; stored docs are unchanged, so no migration and no version flag.
- `set_props` with `left`/`top` keeps the clip's size.
- `get_motion_doc` clips carry `box`, `radius`, `strokes_px` next to the stored props.
- Old inputs (centre x/y, fractions) keep working. Descriptions state the units.
