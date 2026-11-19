# Marketing site: www canonical, old pages redirected, framework and editor pages

Plan: `~/Documents/feega-videos/research/2026-11-19-seo-dusk-sitemap.md` (dusk.bot model).

Before: `SITE_URL` was the apex while the owner wants `www`; `vercel.json` redirected www → apex.
robots.txt named only training crawlers. Ten video-AI landing pages, the upscaler page and three
video guides described the old product and sat in the sitemap.

Changes:
- `SITE_URL = https://www.feega.app`; the www → apex rule is gone. Apex → www is a Vercel domain
  setting, left to the owner (adding it in `vercel.json` too could loop with the current domain
  config).
- robots.txt adds OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, Perplexity-User.
  llms.txt explains how a click maps to source and what gets written.
- Old pages: 301 to `/`, `/design-in-your-codebase` or `/alternatives`; content, images
  (11 MB) and the unused `motion` module deleted.
- `/for/{react,nextjs,sveltekit,vue,tailwind}`, `/integrations/{vscode,cursor,windsurf,vscodium}`
  and their hubs: one data file per page (`landing/src/lib/site/topics/`), one page component,
  one hub component. Facts come from `inspect/` and `packages/{source-map,live-edit,dev-run}` on
  `feat/feega-inspect` (0.2.2). Nuxt and remote workspaces are stated as unverified.
- Breadcrumbs follow the path (`trailOf`), so nested pages get three levels.
- Images: `landing/scripts/topic-images.ts` renders HTML with Playwright and encodes WebP with
  sharp (≤ 80 KB). Run with `node --experimental-transform-types scripts/topic-images.ts`.
- `topics.test.ts` guards ≥ 1,000 words, meta lengths, image weight, read-next targets and a
  list of AI-sounding phrases.
