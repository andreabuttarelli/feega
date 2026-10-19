# Root layout, settings products and project home over the API

The root `+layout.server.ts` is gone. Its load moved to `$lib/server/root-shell.ts` and is
served by `GET /api/v1/me/root`, which answers a bearer caller, or the cookie session when there
is no `Authorization` header (anonymous visitors included). The root `+layout.ts`:

- on the server (SSR of public pages) fetches it through SvelteKit's `fetch`, so the cookie
  session and the full `session` object reach the page as before;
- in the browser (client-only pages, the future static bundle) reads the session from the
  Supabase browser client and the flags with the bearer, passing `host=location.hostname` so the
  tracking guard judges the app's host, not the API's.

`App.PageData.session` is now optional: server page loads no longer have a server parent that
provides it, and SvelteKit's generated types required every such load to return it.

`/p/[projectId]/settings/products` joins the settings sections (`SettingsSection.Products`,
served by the settings API like the others). `/p/[projectId]` (the project home) is a `+page.ts`
reading `GET /api/v1/projects/[projectId]/home`, which runs the old load and answers its
redirect to the first canvas (creating one when the project has none).

Still on the server by choice: social pages (flagged), `render/[token]`, auth flows, gallery,
admin, report.
