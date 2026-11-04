# Properties shows what a layer kind uses, in the mode that uses it

The props audit found the right bar piling every section on every layer. Membership now
lives in tables in `properties-view.ts`:

- `MODE_HIDES`: Design hides Timing, 3D, Transform and Parent & mask, not only Animation
  (M2). `FAMILY_KEEPS` keeps 3D for a 3D model and a camera: there it is the object.
- `FIELD_SHOWN`: Morph and Morph start only in Motion and only when the shape has morph
  targets; before, every rect, stack and group showed them (M1). Fill rule only on a free
  path (L2).
- `SHAPE_PARTS`: Morph to / Morph into / Liquid preset only in Motion. The Path section is
  gone from containers (stack, group, shapes with children).
- `TRANSFORM_HIDDEN`: transform blur is no longer in Appearance; Effects owns blur (M3).
- `PLACEMENT.size`: a stack child sizes in the Stack section only; Layout no longer
  repeats W/H (M4).

Controls: absolute in a stack is a labelled checkbox "Ignore auto layout" (M5); clip
content is the same checkbox on a frame and on a stack (`CheckRow.svelte`, M6). Ellipse
arc reads Start °, Sweep %, Ratio % (M8).

Discarded: hiding transform blur only when zero, a second condition for a value Effects
already covers.
