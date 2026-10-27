# Marketing site moved out of the app into landing/

**Before:** the homepage, the eleven landing pages, `/ai-video-upscaler`, the legal pages and
`/changelog` were routes of the app, hidden in production behind `PUBLIC_SITE_ENABLED` and a
host check (`siteGate`, `rootShowsSite`, `isSiteHost`). feega.app itself is still served by Framer.

**Now:** `landing/` is a standalone SvelteKit project (adapter-vercel, own `package.json`,
own CI job) meant to be its own Vercel project with root `landing/`. It reads the public
changelog from `src/lib/content/changelog/` at build, so the two-changelogs rule is unchanged.
The app has no marketing route left: `/` always goes to the dashboard or `/login`, and every
marketing path answers 301 to the same path on `MARKETING_ORIGIN` (`src/lib/marketing.ts`, one
table). Changelog links in the app menus point there too.

**Discarded:** moving the changelog source into `landing/` (web-docs, release script and both
agent guides read it where it is); sharing `$lib` with the landing (it copies the 40-line
changelog loader instead); moving the in-app `/docs` pages, which use the app's i18n and
components and stay as product docs.
