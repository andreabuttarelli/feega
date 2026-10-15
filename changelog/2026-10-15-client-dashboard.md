# The dashboard renders on the client, from the API

Step 3 of ADR 0009 option d. `/app`, `/app/canvases`, `/app/templates`, `/app/motion` and
`/app/credits`, plus the `/app` layout (sidebar, account menu), no longer have server loads:

- `src/routes/app/+layout.ts` (`ssr = false`) reads `GET /api/v1/me/bootstrap`; each page's
  `+page.ts` reads `GET /api/v1/me/pages/<page>`. Both go through `$lib/dashboard/api.ts`, which
  takes the Bearer from the Supabase browser session and passes the `dz-org` cookie as `?org=`.
- `SwrCache`: a page already seen answers from memory at once; if older than 2 s it revalidates
  in the background and, only when the answer changed, `invalidate`s that load. A write (any
  action) clears the cache.
- Forms keep their `action="?/x"` markup; `use:apiEnhance` posts them to the API and follows the
  answer (`goto` same-origin, `location.href` otherwise; failures through `applyAction`, so
  `form` still carries the error). Workspace switching writes the cookie on the client.
- Auth guard: a 401 from the API redirects to `/login`; the API still enforces every check.

The page server code lives in `$lib/server/dashboard/pages/*` (moved earlier), so the API runs the
exact load/action the routes used to.

Measured locally (dev server, test account): cached navigation `/app` ↔ `/app/canvases` 59–70 ms.
Other `/app/*` tools (studio, compose, upscale, api-keys) keep their server loads; they now render
client-side under the same layout.

Discarded: keeping `+page.server.ts` actions for no-JS posts (the dashboard is behind login and
`ssr = false`, and a static bundle has no server); a per-page fetch without cache (every
navigation would wait on lhr1).
