# `element` node type: read side

A free shape/text/image was a `motion` node with `data.kind: 'element'`, a frame with
its chrome hidden. Step 2 of the plan (free elements are their own node type): every
reader now accepts `nodes.type = 'element'`.

- `motion-node.ts`: `DocNodeType` + `holdsDoc(type)` say which node types hold a motion
  doc; `docKindOf(type, kind)` is the one table mapping type to behaviour. An `element`
  node can never read as a frame, whatever its data says; `data.kind: 'group'` keeps the
  group behaviour.
- `elementNodeSchema`: no format, poster, render, storyboard or budget fields.
- GPU core (`frame-source.ts`, `GpuFlow.svelte`) and every per-type registry (size, label,
  icon, ports, card face, paint, empty hint, share view) have an `element` row.
- `supabase/migrations/20261023120000_element_node.sql` adds `element` to
  `nodes_type_check` (lock/statement timeouts, `not valid` then `validate`). Safe to apply
  at any time: it only widens the check.

Nothing creates `element` rows yet. Content keeps living in `motion_revisions` (history,
undo, realtime unchanged); the data-in-node variant was dropped because it rewrote undo
and revision paths for no user-visible gain. Next: convert existing rows (migration to
apply only after this reader is on `main`), then switch creation.
