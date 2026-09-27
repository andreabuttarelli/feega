# Project settings separated from brand settings

**Before.** Settings sections scoped to a brand (connected accounts, ads, video, danger,
referrals) called `requireBrand` in their own `load` and answered 400/500 on a project without a
brand — the normal case, since `projects.brand_id` is nullable. The "Project" nav group was empty.
Workspace data (API keys, invites, owner flag) was read through the brand's org, so it vanished
without a brand.

**Now.**
- One gate: `settings/+layout.server.ts` computes `brandGate = !brand && sectionRequiresBrand(path)`
  from the `SETTINGS_SECTIONS` table; `+layout.svelte` renders `BrandGate.svelte` (link an org
  brand, or create one via `/brands/new?returnTo=<section>`) instead of the page. Child loads no
  longer throw without a brand.
- The `brand` row is `requiresBrand: false`: that page is where a brand gets linked or created.
- API keys, invites and `isOwner` come from the project's org (`org.role`), brand or not.
- New `settings/project`: rename (`renameProject`), link/switch/unlink brand (`setProjectBrand`,
  brand checked against the org with `findBrand`), delete. Delete is `archiveProject` (soft,
  `archived_at`), the existing repo convention; it needs the exact project name typed.
  The gate's link form posts to `project?/linkBrand` with a `returnTo` restricted to
  `/p/<projectId>/`.

**Discarded.** Moving URLs to `/settings/brand/...` and `/settings/project/...`: OAuth callbacks
(`facebook`, `linkedin`, `connect/[platform]`) are registered with the provider, and `openSheet`
callers, the sheet loader glob and bookmarks all use flat paths. Scope already lives in the table
and the nav grouping; moving would add redirects for no user-visible gain.

**Known, not fixed here.** `settings/referrals` answers 500 with or without a brand: the
`referrals`/`referral_codes` tables do not exist on the new schema. `settings-actions.ts` reads
`params.brand`, which `/p/[projectId]` never has (svelte-check flags it).
