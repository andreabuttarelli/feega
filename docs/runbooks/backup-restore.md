# Backup and restore — Supabase `klnswzhhgrqvbfjzioul` (feega)

State checked 2026-10-14, read-only:

- Org `cxgisjjztnuqtmmcvnoa`, plan **Pro**. Region `eu-west-2`, Postgres 17.
- **Daily backups**: included in Pro, kept **7 days**. Restore granularity: one day.
- **PITR**: paid add-on, not visible via MCP. Check Dashboard → Project Settings → Add-ons.
  WAL archiving is on (`archive_mode=on`), but that alone is not PITR. Assume **no PITR**
  until the add-on page says otherwise.
- **Storage is not in the backup.** Buckets (`brand-knowledge`, `canvas-assets`, `media`,
  `influencers`, `embeds`, `quarantine`, `reference-images`, `website`) are not restored by a
  database restore. A deleted object is gone.

## Restore

1. Stop writes: pause crons / put the app in maintenance (Vercel: roll back or pause project).
2. Dashboard → Database → Backups → Scheduled backups → pick the day → Restore.
   With PITR: Backups → Point in time → pick the timestamp.
3. Restore is **in place**: the project is down for minutes to hours, and every write after
   the backup point is lost. If only some rows are needed, restore to a **new project**
   instead (Backups → "Restore to new project"), then copy the rows back with SQL.
4. After restore: `node scripts/schema-drift-check.mjs` (must be VERDE), then `npm run
   eval:bootstrap` and `npm run eval:canvas`.
5. Realtime publication and `replica identity full` live in the dump; verify with
   `eval:canvas`, not by assumption.

## Before a risky change

Take a manual dump; the daily backup can be up to 24 h old:

```bash
supabase db dump --db-url "$DATABASE_URL" -f backup-$(date +%F).sql
supabase db dump --db-url "$DATABASE_URL" --data-only -f data-$(date +%F).sql
```

## Who to call

- Owner: Andrea Buttarelli (Supabase org owner, Vercel team owner).
- Supabase support: Dashboard → Support → new ticket, severity "Production down"
  (Pro: email support, no SLA). Include project ref `klnswzhhgrqvbfjzioul`.
