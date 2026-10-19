# Legal pages of the marketing site, rebuilt off Framer

First step of moving www.feega.app from Framer into this app. The eight legal pages
(terms, privacy, cookies, acceptable use, AI transparency, legal notice, DPA, sub-processors)
now render from `src/routes/(site)/[doc=legal]` with the site header and footer in
`src/lib/site/`.

- Copy is extracted from the live Framer pages as semantic HTML (`src/lib/site/legal/*.html`),
  no Framer runtime or CDN. Terms use the mobile copy: Framer's desktop layer is stale and lacks
  the Google/GitHub sign-in disclosure.
- Fonts self-hosted in `static/site/fonts`: BDO Grotesk (SIL OFL, Lokal Container) at wght 500,
  DM Sans (OFL) for the footer wordmark.
- Layout breakpoint 1200px, as on Framer; below it header and footer cap at 430px.
- Parity measured against the live site at 375/768/1280/1440/1920 (pixel match, SSIM, a ±3px
  shift-tolerant match); diffs in `~/Documents/feega-videos/site-migration/`.
- Nothing changes for oh.feega.app: `/` still redirects into the app. Serving the homepage on the
  site host comes with the homepage itself.

- Hidden in production: every `(site)` route answers 404 when `VERCEL_ENV=production` unless
  `PUBLIC_SITE_ENABLED=true` (`siteVisibility`, `siteGate` in `hooks.server.ts`). Local and preview
  deploys show it.
