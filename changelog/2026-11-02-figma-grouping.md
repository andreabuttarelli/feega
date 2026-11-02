# Groups and Frame selection behave like Figma inside a frame

Audit findings: props C8, nesting H3, M9, M13, L7.

A light group (`group: true` on a Shape rect, made by ⌘G) was shown and edited as the rect it is
drawn with: header "Shape" named "Box", fill/radius/morph/clip content in the inspector, and
X/Y/W/H written to the group's props, which `settleGroups` refitted to the members on the next
edit, so nothing moved.

- `clipFamily` gives a group its own `ClipFamily.Group`; `sectionsFor` shows it placement,
  appearance, effects, timing and parent only, and `fieldShownFor` keeps x/y/width/height of the
  Shape fields. One table each, in `properties-view.ts`.
- `placeLayer` (light-group) maps X/Y/W/H of a group onto its descendants (translate, scale from
  the top-left); anything else falls through to `setProps`. The inspector, PositionSection and
  the `set_props` MCP tool all go through it.
- `clipName`, `elementName`, `elementKind` call a group "Group". `clipName` now also honours a
  layer's own `name` (a renamed layer kept showing its component in the header).
- Grouping or framing stack children bakes the laid-out box into the members first: they kept
  stale props and jumped when parented to a non-layout container. The group stays in the stack
  at the members' place (already true via `takePlace`).
- `ungroupLight` hands members to the group's parent and, inside a stack, puts them back in the
  stack order at the group's index (`reordered`, now exported from layout ops).
- Frame selection names its container "Frame"; the canvas already selected it.
- Delete of a container takes its descendants (`removeLayers`), in the editor and in the
  `remove_clip` MCP tool. Before, the frame-side delete orphaned the children while deleting a
  free stack on the canvas took them. A Null still lets go of what it rigs (AE parenting).

Not done: a group is still a Shape clip with a flag, not its own component; rotation of a group
from the inspector still turns the group transform only.
