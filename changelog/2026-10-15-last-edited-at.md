# Recents ordered by last edit

`canvases.updated_at` and `projects.updated_at` had no trigger: in production 1 canvas in 129
had ever moved past its creation. The dashboard sorted and dated canvases by creation, and
`listProjects` derived activity by embedding every node of every project (`canvases(nodes(...))`),
called several times per navigation.

`20261015120000_last_edited_at.sql` adds `last_edited_at` to both tables, backfilled from nodes
and `motion_revisions`, indexed on `(org_id, last_edited_at desc)`. Triggers on `nodes`
(insert/update) and `motion_revisions` (insert) bump canvas and project, at most once per 30 s
so dragging a node does not rewrite the canvas row (and its realtime event) on every frame.
Labels read "Edited 5 minutes ago".

Must be applied before the code reaches production: the code selects the new column.
