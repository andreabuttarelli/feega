# Self-host: a fresh clone runs in about ten minutes

**Before:** the repo held no migration that creates the current schema (`orgs`, `projects`,
`canvases`, `nodes`...): production was built by hand, and the 386 files in `supabase/migrations`
describe the previous product. `db-seed` wrote to tables that no longer exist, the compose file
referenced services that were removed (`worker`, `cron`, `realtime-policies`), the app image failed
to build (`worker:build`, `patch-package` in the runtime stage), and `.env.example` listed ~100
variables with no hint of which ones the app needs.

**Now:**
- `supabase/baseline/*.sql`: the whole current schema, generated read-only from production catalogs
  (tables, constraints, functions, indexes, triggers, RLS, storage buckets and policies, realtime
  publication, grants, two reference tables). Verified by table/column/index/policy counts and a
  checksum of columns and policies against production.
- `db:migrate` applies the baseline, then only files dated after `20261024090000`. Legacy migrations
  stay in place (immutable) and are not applied.
- `npm run setup` fills `.env` from `supabase status`, migrates and seeds. The seed creates a demo
  user, org, project, canvas and one motion frame.
- `docker compose up` in `infra/compose`: stack, `migrate` one-shot (prints the login), app. The app
  shares Kong's network namespace so browser and server use one `PUBLIC_SUPABASE_URL`. Ports bind to
  127.0.0.1; `infra/compose/.env` is committed with public demo secrets.
- `.env.example`: required block, then optional keys by feature. `BILLING_PROVIDER=open` by default.
- A missing optional key names itself: `enableHint` maps the error to "Add KEY to .env to enable X"
  in the moderation gate that every AI action passes through.
- `npm run smoke:selfhost`: login, frame, shape, animation, PNG export, on a running instance.

**Found by running it:** Chromium in the container needs `--no-sandbox` (`CHROMIUM_ARGS`), the
Dockerfile set a variable nothing read (`CHROMIUM_EXECUTABLE_PATH`), the Vercel analytics script
guard had been lost from `+layout.ts` (404 on every self-hosted page), a half-initialised database
volume survives a failed first start, and a bind mount from `~/Documents` hangs the database
container on macOS.

**Discarded:** one `0000_baseline.sql` (split by kind so a failure names a section); the cron and
worker services (the worker is gone from the code); the old `.env.example` of the compose stack
(replaced by the committed `.env`).

**Limits:** `ai_models` starts empty (sync after adding provider keys); the baseline is a snapshot,
so later schema changes are new dated files.
