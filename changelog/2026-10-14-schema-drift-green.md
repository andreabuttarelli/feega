# Schema drift check reads both migration dirs and goes green

**Before:** `schema-drift-check.mjs` read only `supabase/migrations`. The `nodes_type_check`
widenings live in `supabase/canvas-migrations` (`20261004_studio_batch_node.sql`), so every
`nodes.type = 'motion'` write was reported as rejected. On top, 145 old-product migrations
and 28 old-product tables made the result permanently ROSSO (261), so nobody read it.

**Now:**
- Both dirs are read, merged by timestamp (`YYYYMMDD_` canvas files sort as `YYYYMMDD000000`).
- `scripts/schema-drift-known.json` lists, each with a reason:
  - `retiredMigrations` — the 145 files never applied to `klnswzhhgrqvbfjzioul` (all dated
    before the project was rebuilt on 2026-09-21). Their names stop counting only when no code
    names them.
  - `knownCodeDrift` — 56 tables/columns the code still names and prod lacks. Printed as
    "NOTI, NON FATALI", not hidden. Entries marked `LIVE:` are reachable from current routes
    and should be fixed or deleted, then removed from the file.
- Anything new is still fatal (exit 1).
- CI job `schema-drift`, non-blocking: needs repo secrets `DRIFT_SUPABASE_URL` and
  `DRIFT_SUPABASE_ANON_KEY`; without them it warns and skips.

Verified via MCP: every canvas-migration is in effect in prod. `tenancy_grants`,
`stripe_sync_grants`, `credits_from_price_id`, `motion_node`, `motion_templates` and the
`supabase/migrations` files from 2026-10-03 to 2026-10-10 are absent from
`schema_migrations` but their objects exist (applied by SQL editor).

Also: `docs/runbooks/backup-restore.md`.
