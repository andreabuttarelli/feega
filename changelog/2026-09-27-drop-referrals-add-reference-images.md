# Sync query-tables.ts with production: drop referrals, add reference_images

`packages/api-contracts/src/query-tables.ts` is generated from `supabase/migrations`
(`scripts/query-tables-from-migrations.mjs`), and `query-tool.test.ts` enforces it stays in sync
with what a migration actually creates — not with what's live in production. `reference_images`
already has a migration and is live; adding it was correct. `referral_codes`/`referrals` are
create-only (`0143_referrals.sql`, no drop) even though the referrals feature and its UI section
are already gone (`settings-nav.test.ts` asserts as much) and the tables don't exist in
production.

## What changed

- `supabase/migrations/20260927173000_drop_referrals.sql` — same pattern as
  `20260921191000_drop_leads.sql`: a real drop migration, not a hand-edit of the generated file,
  so the generator's rule ("a table exists if a migration creates it") stays true without an
  exception list. Deploys don't run migrations here — apply by hand.
- Regenerated `packages/api-contracts/src/query-tables.ts` and `cli/lib/contracts/query-tables.ts`
  (`node scripts/query-tables-from-migrations.mjs --write` + `bun run sync:contracts`).
- `write-rules.ts` unaffected (referrals carried no column grants).

## Discarded

- Hand-removing the ~110 tables the generator lists that are also absent from production (old
  Anomalia schema, e.g. `organizations`, `talents`, `brand_canvas_items`). The generator's own
  rule is migration-based, not production-based — `query-tool.test.ts` says so explicitly. Bulk
  deletion needs its own pass of drop migrations, one per removed feature, not a hand-edit here.
