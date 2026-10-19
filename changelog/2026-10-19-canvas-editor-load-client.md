# Canvas and frame editor load in the browser

`p/[projectId]/c/[canvasId]` and its `motion/[nodeId]` editor now load through `+page.ts`
(`ssr = false`) with `loadPageData(url)`, which reads the page's bearer twin from the
`BEARER_PAGES` table in `$lib/api/page-action.ts` (same handlers, ADR 0014). The two
`+page.server.ts` keep only `actions` (+ `config`), used by route tests and a few e2e that post
directly; no client posts to them any more.

`pageLoadOf` turns a 401 into a redirect to `/login` and any other error into a SvelteKit
`error(status, message)`, so the page error screen is unchanged.

Why: ADR 0009 (d), the native bundle has no SvelteKit server. Cost: no SSR HTML for these two
pages; both were client-rendered in practice already.
