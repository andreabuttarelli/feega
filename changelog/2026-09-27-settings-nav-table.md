# Settings nav: one table instead of three parallel arrays

Step A of the project/workspace/brand settings split. `SETTINGS_GROUPS`, `SETTINGS_SECTIONS`,
`SETTINGS_BRAND_SECTIONS` and `SETTINGS_ADS_SECTIONS` in `platforms.ts` were four parallel lists
that had to stay in sync by hand — a section added to one and forgotten in another was invisible
until someone hit the gap.

## What changed

`SETTINGS_SECTIONS` is now one table: `{ path, labelKey, scope, requiresBrand }[]`. `scope` is
`'project' | 'workspace' | 'brand' | 'account'` — `project` is empty today, reserved for the
sections a later step moves there. `SETTINGS_GROUPS` (still consumed by `CanvasSheet.svelte` and
the settings layout) is derived from the table by grouping on `scope`, in the fixed order
Progetto, Workspace, Brand, Account; an empty group (Progetto, for now) is omitted rather than
rendered blank.

Sub-flows that don't get their own nav entry (`facebook`, `linkedin`, `connect/[platform]`) are
rows in the table too — so the brand gate below applies to them — but are filtered out of
`SETTINGS_GROUPS` by a small hidden-from-nav set, not by living in a separate array.

## The brand gate moves off a single hard-coded route

`+layout.server.ts` used to special-case exactly `settings/brand` as the only section allowed to
load without a brand; every other section called `requireBrand(brandOrNull)`, which throws
(500) when the project has none. The layout's own load no longer calls `requireBrand` at all: it
returns the same empty-shaped defaults regardless of which section is being viewed, and lets
`data.brand` be `null`. `sectionRequiresBrand(pathname)`, exported from `platforms.ts`, reads
`requiresBrand` off the table and is the one place that decision is made — ready for the pages
themselves (a later step) to use it instead of throwing.

Child pages under `settings/*` that still call `requireBrand` in their own `+page.server.ts`
(`connected-accounts`, `video`, `danger`, …) are unchanged — moving them to the friendly gate is
scoped to a later step, not this one.

## Tests

`settings-nav.test.ts`: group order and omission of the empty Progetto group, that the same nav
renders regardless of brand presence, that sub-flows don't appear as top-level entries, and
`sectionRequiresBrand` for every section. `layout.server.test.ts`: the load doesn't throw and
never calls `requireBrand` when the project has no brand.
