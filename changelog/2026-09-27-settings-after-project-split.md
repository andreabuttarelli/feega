# Settings actions after the project/brand split

Commit 2df1afe1 moved settings under `/p/[projectId]/settings`, but `settings-actions.ts` still
read `params.brand` — a parameter those routes never have. Sync, disconnect, delete brand, API
keys, invites and every billing action answered "Brand not found" or 403.

## What changed

- **Actions resolve the project.** `settingsScope(supabase, projectId)` reads `projects.org_id`
  and `brand_id` (live projects only, RLS client), then the brand scoped to that org. Org-level
  actions (API keys, invites, billing) work without a brand; brand actions (sync, disconnect,
  delete brand) say "Brand not found" when the project has none. Owner checks go through
  `isOrgOwner`, not a brand slug. Deleting the brand lands on `settings/brand`, not `/app`.
  Dead `setChatDefaultTier`/`setWebsite` removed (no route used them).
- **Billing is a project settings page.** `/app/billing` moved to
  `/p/[projectId]/settings/billing` (page, actions, test), keyed on the project's org via
  `orgBillingById` and `portalLink(billing, …)`. Every link to `/app/billing` — ads checklist,
  seat-fee redirects, upgrade link, canvas "Buy credits", API `app_billing_url` — now points at
  `billingPath(projectId)` (API: `appPathForBrand`). `src/no-app-billing-links.test.ts` replaces
  `paywall-routes.test.ts`, which asserted the old route existed.
- **Referrals removed** end to end: `referrals`/`referral_codes` don't exist in the new schema,
  so the page 500'd. Route, `referrals.ts`, the `?ref=` cookie capture in `hooks.server.ts`,
  the dead `grantCredits`, the nav row and the i18n block are gone.
- **Archived projects stay closed.** `findProjectForUser` filters `archived_at is null`, so
  `/p/<archived>` is a 404. Lists and `enterApp` already used `listProjects`, which filters.
- **Deleting a project lands on another one.** The delete action redirects to
  `homePathFor(…)` — the most recent live project, or exactly one new "Untitled" when none is
  left (the existing `firstProjectOnce` guard prevents duplicates). A project home with no
  canvas now creates one instead of bouncing through `/app`.

## Not done

- Invites: no accept route exists; the email now links to `/login?invite_token=…`.
- `/app` itself remains as a 308 bootstrap; other callers still fall back to it (login/auth
  fallbacks, OAuth/CLI callback cancel links, error page, workspace switcher, `APP_BOOTSTRAP_PATH`).
- `billing/dazero-provider.upgradeUrl` has no callers and still names an `/app/<slug>` path.
