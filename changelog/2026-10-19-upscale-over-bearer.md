# Upscaler loads and posts over bearer

`/app/upscale` joins the dashboard pages (`DashboardPage.Upscale`, server moved to
`$lib/server/dashboard/pages/upscale.ts`): `+page.ts` loads through `loadPage`, `start` posts
through `postPageAction`. The redirect to the running job comes back as `{ redirect }` and the
page follows it as before.

Not migrated: `render/[token]`. It is a capability link the motion agent hands out, opened in a
browser; it authenticates by token plus an httpOnly claim cookie, not by a user bearer, so it has
no place in the native bundle.
