# Calendar: no-brand overlay instead of a dead-end link

`+page.svelte` showed a text hint linking to Settings → Brand when a project had no brand —
a settings page reachable only after leaving the calendar, with no way back.

## What changed

An overlay now sits over the (blurred, inert) calendar grid when `data.brand` is `null`:
link an existing org brand (`data.brands`, already returned by `buildCalendarData`) via a
new `linkBrand` form action, or a "Create brand" link into the wizard.

`linkBrand` in `calendar/+page.server.ts` writes `projects.brand_id` through the existing
`setProjectBrand` (`repos/projects.ts`) — no new DB primitive.

The wizard's `create` action (`brands/new/+page.server.ts`) now accepts a `returnTo` field
and redirects there instead of the new brand's page, but only when it starts with `/p/` —
anything else is ignored and the old redirect stands. The calendar's "Create brand" link
sets `returnTo=/p/{projectId}/calendar`.

The post popover's delivery rows now carry small `publishNow`/`cancel` forms per account,
wired to the actions that already existed in `+page.server.ts` but had no UI caller.

## Tests

`calendar.actions.test.ts`: `linkBrand` writes `brand_id` scoped to `org_id`, rejects an
empty `brandId` without writing. `brands/new/page.server.test.ts`: `create` redirects to a
safe `returnTo`, falls back to the brand page for an unsafe one.
