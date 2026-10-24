# Light group (Cmd+G)

ST-05. Cmd+G precomposed the selection into a nested composition with its own timeline: heavy
for what Figma users mean by "group".

- `groupLight` (`light-group.ts`): a transparent container clip flagged `group`, members
  parented to it, no composition. `settleGroups` runs on every committed edit (editor session and
  MCP `apply`): the group's box is the union of its members, and a group with no members is
  removed. `ungroupLight` releases the members at their world position.
- Ungroup handles both kinds. Precompose stays (`precompose` tool) for real compositions; it has
  no editor shortcut on the canvas.
- MCP: `frame_clips` takes `group: true`; `ungroup` takes a light group.
- Not done: Esc "select parent" for parent-linked groups (it still follows composition hosts).
