# Live schema drift: fixed or deleted

`scripts/schema-drift-known.json` marked nine `LIVE:` names: reachable code reading columns or
tables production never had. Each one either points at the real schema now, or is gone.

Fixed:
- `api_keys.permissions` → `org_id` + `scopes`. `/api/v1/brands/[slug]/api-keys` lists, mints
  and revokes on the brand's org. `/app/api-keys` redirects to `/p/<project>/settings/api-keys`,
  which already used the real columns. Per-brand key scoping has no column: keys are per org.
- `profiles.full_name` → `profiles.name` in the settings profile page and `updateProfile`.
- `robots.txt` / `sitemap.xml`: no database read; only public pages. Hosted blogs are gone.

Deleted (old product, no caller or no client):
- 80% credit warning (`org_usage`): no caller, and the `credit_ledger` balance model has no
  period quota to take 80% of. A low-balance alert would be a new feature, not a port.
  `brand-contacts`, `brand-notify` went with it.
- Web push (`push_subscriptions`): no client ever subscribed. Routes, `web-push.ts`, the
  render-done push in motion, VAPID env vars.
- `/l/[code]`, `/api/v1/links/hit` (`post_links`), `/p/[projectId]/posts/download-media`
  (`posts.media_urls`).
- `/api/v1/health/costs/tick` cron: brand-less AI calls are now normal; wrote to `incidents`.
- Unused `cli-queries` functions (voice, calendar, web, usage, agent session).

Left: `web-push` npm dependency (lockfile change out of scope); the service worker push handler
(harmless; removing the SW changes registration for existing clients).
