# Named frame versions

Version history and restore already existed; versions had only numbers. A name now
lives on the frame node (`data.versionNames`, version → name), not on
`motion_revisions`: revisions are append-only (insert/select policies only) and a
column would need a migration nobody runs on deploy. `nameVersion` patches node
data; `namedRevisions` merges names into the listing.

Editor op `name_revision` (MCP via `motion_editor_op`), chat tool
`name_revision`, `list_revisions` returns names. Canvas-wide named versions are not
done: they need a snapshot table (schema decision).
