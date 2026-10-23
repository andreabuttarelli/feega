# Named canvas versions

Migration `supabase/migrations/20261018150000_canvas_versions.sql` (applied; lock/statement
timeouts, RLS read by org, write by editors): `canvas_versions` with a jsonb snapshot of every
node (position, size, data), connection id and motion head doc.

`saveCanvasVersion` / `listCanvasVersions` / `restoreCanvasVersion`: restore first saves
"Before restoring …", then applies `planCanvasRestore` through the existing repo writes
(soft delete/revive nodes and edges, motion docs as new revisions), so history is kept and
collaborators see it live through realtime. Canvas ops save/list/restore_canvas_version (MCP
parity), page actions, "Versions…" in the canvas menu. The table is not in the generated
types yet: the repo reaches it through a narrow typed view until `npm run db:types` after apply.

Rebased on the GPU-only canvas (2026-10-23): the dialog hangs off the page, not the removed DOM
canvas, so nothing had to move. `tests/e2e/canvas-versions.spec.ts` proves save then restore
through the canvas menu. Pins updated for the three new canvas ops.
