# Assets, influencers and new brand over bearer

`/p/[projectId]/assets`, `/influencers` and `/brands/new` load and post through
`/api/v1/projects/[projectId]/pages/[page]` (`ProjectPage` registry in `$lib/project-pages.ts`),
running the pages' own load and actions (moved to `$lib/server/project-pages/`). `asset-filter`
moved to `$lib/assets` so the server module does not import from a route.

`BEARER_PAGES` now derives a row for every dashboard page (`PAGE_PATH`) and every project page
(`PROJECT_PAGE_PATH`); the explicit compose-list row is gone. Each row's reader carries its
transport: dashboard posts go through `postApi` (clears the SWR cache), page twins through the
bare caller.

`apiEnhance` now enhances any form whose page has a twin, not only dashboard pages, and resolves
`?/action` against `location` (the URL a sheet pushed), not `page.url`. On success it resets the
form and runs `invalidateAll`, like SvelteKit's `enhance` default — dashboard forms gain that
refresh too.

Not migrated: the root `+layout.server.ts` still runs for every page.
