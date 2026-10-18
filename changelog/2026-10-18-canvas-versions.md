# Named canvas versions

Migration `supabase/migrations/20261018150000_canvas_versions.sql` (NOT applied; lock/statement
timeouts, RLS read by org, write by editors): `canvas_versions` with a jsonb snapshot of every
node (position, size, data), connection id and motion head doc.

`saveCanvasVersion` / `listCanvasVersions` / `restoreCanvasVersion`: restore first saves
"Before restoring …", then applies `planCanvasRestore` through the existing repo writes
(soft delete/revive nodes and edges, motion docs as new revisions), so history is kept and
collaborators see it live through realtime. Canvas ops save/list/restore_canvas_version (MCP
parity), page actions, "Versions…" in the canvas menu. The table is not in the generated
types yet: the repo reaches it through a narrow typed view until `npm run db:types` after apply.
