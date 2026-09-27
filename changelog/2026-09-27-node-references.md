# Reference photos on image and video nodes

## Why
Using a reference image meant adding an image node and wiring it. Now the node itself holds
references, picked from a global catalogue (seeded from `/imgs`) or the project's media.

## What
- `nodes.data.references: { source: 'catalogue' | 'asset', id }[]` on `image`/`video`
  (optional, old nodes unchanged). Ids only — URLs are signed at run time.
- New table `reference_images` (`org_id` null = global, RLS read global + own org) and private
  bucket `reference-images` (`catalogue/` readable by any session):
  `supabase/migrations/20260927180000_reference_images.sql` — **not applied**.
- Seed: `node --env-file=.env node_modules/.bin/vite-node --config scripts/vite-node.config.ts scripts/seed-reference-images.ts`
  (`-- --dry-run` to list). Idempotent on `storage_path`.
- Generation: `upstream.ts` resolves picked refs to URLs; `resolveUpstreamInputs` appends them
  AFTER connected images, capped by the model's max refs (overflow lands in `rejected`).
  Image renders send them as attached references (`userRefImages`), never as the edit base;
  video sends them in `referenceImageUrls`.
- Until migration + seed run, catalogue reads return empty (missing-table codes swallowed).

## Discarded
- `assets` rows with `org_id` null: `assets.org_id` is NOT NULL.
- Public bucket: kept private to match the influencer catalogue pattern.
