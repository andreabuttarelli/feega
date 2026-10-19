# One domain: the app and the marketing site both live on feega.app

Status: proposed (2026-10-19). Nothing below is live until the user orders the cutover.

## Decision

`https://feega.app` serves both the marketing site and the app; `www.feega.app` and
`oh.feega.app` answer `308` to the same path on `feega.app`.

- **`/` is the marketing homepage for everyone.** Signed-in visitors see it too, with "Let's start"
  leading into the app; the app keeps its own routes (`/login`, `/p/…`, `/app/…`, `/a`, `/d`, `/e`,
  `/s`, `/api/…`). A signed-in user lands in the app from `/login` (which already forwards a live
  session to `homePathFor`) and from every link the product sends (emails, OAuth returns, CLI).
  Rejected: `/` switching on the session. The same URL would render two different pages, the
  homepage could not be cached, and crawlers and logged-in people would disagree about what `/` is.
- **Site paths and app paths never collide.** Site: `/`, the eight legal pages, the eleven landing
  pages, `/ai-video-upscaler`. App: everything else. The cutover PR adds a test that fails when a site
  slug matches an app route.
- **Visibility stays one rule.** `siteVisibility`/`rootShowsSite` in `src/lib/site/visibility.ts`
  (flag `PUBLIC_SITE_ENABLED`, `VERCEL_ENV`), applied by `siteGate` and the root redirect in
  `hooks.server.ts`. At cutover `isSiteHost` becomes "the one production host".

## What has to move with the host

| Area | Today | At cutover |
|---|---|---|
| Redirects | `host-redirects.ts`: dalnulla, r.feega.app → www | add `oh.feega.app`, `www.feega.app` → `feega.app`, path and query kept, `308` |
| `PUBLIC_APP_URL` / `siteUrl` | `https://oh.feega.app` (prod) | `https://feega.app`; canonical, sitemap and emails follow |
| Auth cookies | Supabase SSR cookies, host-only on oh.feega.app | host-only on feega.app: every user signs in once more after the switch (no shared parent-domain cookie: it would leak the session to any subdomain) |
| Supabase Auth | Site URL + redirect allow-list on oh.feega.app | Site URL `https://feega.app`; allow-list adds `https://feega.app/**` and keeps oh.feega.app during the transition |
| Google / GitHub OAuth apps | callback `https://<supabase>/auth/v1/callback` (unchanged); authorised origins oh.feega.app | add `https://feega.app` to authorised JavaScript origins / homepage URL |
| Native shell (Tauri) | `apps/native/src-tauri/src/routing.rs` `PRODUCTION_URL = oh.feega.app`; `feega://auth/callback` returns to it | change `PRODUCTION_URL`, release a new build; the 308 keeps old builds working |
| CLI | `cli/lib/config.ts` `PRODUCTION_URL = oh.feega.app` | change it, release `cli-v*`; old CLIs follow the 308 (POST bodies survive `308`) |
| MCP / OAuth server | issuer and resource derived from the request origin (`.well-known/oauth-authorization-server`, `oauth-discovery`) | issuer becomes `https://feega.app`; existing MCP clients must re-authorise; `mcp.feega.app` unaffected |
| Embeds | `packages/feega-motion-react` / Flutter `DEFAULT_ORIGIN = oh.feega.app`; `/embed.js` loader | change the defaults and publish the packages; the 308 keeps old embeds loading |
| Webhooks | only `/api/webhooks/didit` lives in this repo; Stripe and RevenueCat endpoints are configured in their dashboards | point each dashboard at `https://feega.app/...`; a webhook POST must not depend on a redirect |
| CSP / CORS | no app-wide CSP header; embed loader sends `access-control-allow-origin: *` | nothing to change; re-check any provider allow-list that names oh.feega.app |
| robots / sitemap | app robots disallows `/app`, `/api`, `/auth`; sitemap lists `MARKETING_PATHS` | one robots for both; sitemap lists the site paths and the docs |
| Framer URLs | www.feega.app/* on Framer | same paths on feega.app; `/work/*` and `/drafts/page` → `/` (308) unless kept; resubmit sitemap |
| Analytics / consent | app cookie banner + PostHog on every route | open question: same banner on the marketing pages, or a lighter site policy |

## Cutover checklist

1. `PUBLIC_SITE_ENABLED=true` on a preview, full smoke test there.
2. Code PR: `PUBLIC_APP_URL`, host redirects (+ tests), CLI and native and embed defaults, robots and sitemap.
3. Supabase Auth Site URL and allow-list; Google and GitHub OAuth origins.
4. Stripe and RevenueCat webhook URLs.
5. Vercel (user): add `feega.app` as the production domain, `www` and `oh` as redirecting domains.
6. DNS (user): lower TTL a day before; apex and `www` to Vercel; keep `oh` on Vercel.
7. Merge and release dev → main with `PUBLIC_SITE_ENABLED=true` in production.
8. Verify: `/` and site pages 200 with canonical on feega.app; oh/www paths answer 308; sign-in,
   OAuth, native login, CLI login, MCP connect, a Stripe test event.
9. Search Console: add `feega.app`, submit the sitemap, change of address from www; watch 404s.
10. Release CLI, native build and embed packages with the new default; keep Framer unpublished,
    not deleted, for a week.
