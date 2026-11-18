# Account and workspace settings move to the dashboard

Every settings section lived under `/p/<project>/settings`, so changing your profile or an API key
meant opening a canvas first. The scope table `SETTINGS_SECTIONS` already said which sections are
`project`, `brand`, `workspace` or `account`; it now also says where each scope lives
(`SCOPE_HOME`), and nav, redirects and the API read that one table.

- Workspace and account sections (profile, appearance, api-keys, models, fonts, spend, content)
  are served at `/app/settings/<section>` by `/api/v1/me/settings/[section]`. The handlers in
  `pages/*.ts` are the same; the org comes from `parent()` instead of `params.projectId`.
- Page components moved to `$lib/components/settings/pages/` (separate move commit); both routes
  render them.
- `settingsTarget` maps a path shape to its API base through one `SURFACES` table.
- Spend is mixed: the dashboard edits org-member caps, the project edits its own caps
  (`capScopesOn` / `editableCaps` in `spend-caps/policy.ts`). The project keeps `/settings/spend`
  (`alsoOnCanvas`).
- Old `/p/<id>/settings/<dashboard section>` URLs redirect (settings `+layout.ts`).
- Duplicates: `/app/team` already exists, so the settings `team` section links to it and its stub
  page is gone. `/app/api-keys` now redirects to `/app/settings/api-keys`, the only copy.
  Billing and credits were never settings sections and are untouched.
- Discarded: serving the dashboard sections from the canvas API only; the project id was only used
  to find the org.
- Brands move in a later change.
