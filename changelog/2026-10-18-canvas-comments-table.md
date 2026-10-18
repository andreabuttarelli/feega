# Table for canvas comments

Comments pinned to the canvas or to a node need a home; `canvas_events`
is an audit log and node data would make every comment a node write.

`canvas_comments` (migration `20261018120000_canvas_comments.sql`):
`canvas_id`, optional `node_id` (pinned to a node; `x`/`y` are then
relative to it, else canvas coordinates), `parent_id` for replies,
`author_id`, `body` (1–2,000 chars), `resolved_at`, soft `deleted_at`.
RLS: every org member reads and writes their own comments (viewers too,
as in Figma); the author or an editor can update (resolve, soft delete).
No delete policy: removal is the soft delete. Indexes on every foreign key
plus the live comments of a canvas.

The code (repo, actions, broadcast, pins on both canvases) comes in the
next change, after the migration is applied and `npm run db:types`
regenerates the types — the schema-drift check would otherwise fail on a
table the database does not have yet.
