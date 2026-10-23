# Convert free-element rows to `nodes.type = 'element'`

`supabase/migrations/20261023130000_element_node_rows.sql`. Apply ONLY after the
`element` reader (`Read element nodes as their own type`) is deployed on `main`:
production code without it would stop drawing every free element.

- Every live `motion` node with `data.kind` `element` or `group` is recorded in
  `element_node_migration` (old `data`, and whether its head doc has no clips), then
  becomes `type = 'element'` with only `docHeadRevision`, `posterRevision`,
  `interactive`, `kind: 'group'`, `rotation`, `groupId`. Frame-only fields go.
- Rows whose head doc is empty (the empty frames the Delete bug left) are soft-deleted.
- `motion_revisions` is untouched.
- Rollback: `supabase/rollbacks/20261023130000_element_node_rows.down.sql` restores type,
  old data (keeping the newer head revision) and the soft-deleted rows, drops the audit
  table and the `app_schema_migrations` row.
