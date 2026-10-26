# `element` node type: write side

Step 4 of free elements. Every path that makes a free element now writes
`nodes.type = 'element'`: draw tools, SVG paste/import, Figma paste, drag out of a
frame, a generated output dropped on the canvas, group/ungroup.

- `elementNodeOf` / `frameNodeOf` / `drawnFrameNodeOf` return the node `type`;
  `FrameStore.create` writes it. Element data: `{ docHeadRevision, kind?: 'group' }`
  (plus `format` from the store), the shape the row migration produces.
- Content stays in `motion_revisions` (#1197).
- Readers that looked at raw `data.kind` now go through `docKindOf(type, kind)`:
  selection menu (`selection-actions.ts`), GPU stand-in `data-kind`, `frameDefaultSize`
  (an `element` row without a size was sized as a 288px frame).
- Duplicate and copy-paste copied the row only: a frame or free element came back empty
  (no revision) and, for elements, without its size. They now copy the head revision
  (`copyHead`) and the size; a legacy `motion` + `kind: element|group` row is written as
  `element` (`currentDocNode`).
- Legacy rows read as before until `20261023130000_element_node_rows.sql` runs.
- MCP descriptions of grouping say `type element`; tool pins refreshed.

Not done: `enterFrame` in GpuFlow passes `data.kind` where it expects a type (pre-existing).
