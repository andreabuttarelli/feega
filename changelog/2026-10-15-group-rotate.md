# Group rotation; frames inside groups

ADR 0011 amended. `data.rotation` and `data.groupId` are layout fields every node type accepts
(`nodeLayoutSchema` in `canvas/node-layout.ts`, kept by `validateNodeData` and allowed by
`unknownFieldsError`). Rotation renders as CSS `rotate` on the SvelteFlow node wrapper, so it
composes with SvelteFlow's own `transform`.

⌘G now takes any mix: free elements merge into the group doc as before; other nodes (frames,
generation nodes) join via `groupId` and stay live nodes. The group is sent behind (`z = -1`).
Ungroup releases members. Rotate handle on a selected group (`CanvasTile`, `dragAngle`, Shift
snaps 15°) → action `rotateGroup` → `rotateNodeGroup` → `moveNode` + `patchNodeData` per member.
Dragging a group → `moveGroup` → members move by the same delta (optimistic on the client).
Repos go through the `Members` port (`node-members.ts`). MCP: `rotate_group`, `move_group`.

Not done: scaling a group with members, undo of a rotation, the live drag of members while the
group is being dragged (they jump on drop).
