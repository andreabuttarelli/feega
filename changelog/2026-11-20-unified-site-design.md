# One design for landing, docs and blog

The catalog pages (`/for/*`, `/integrations/*`, alternatives, compare, hubs), the docs and the blog each had their own spacing, type sizes and navbar; text was small and everything sat close together.

`packages/site-theme/` is now the single source: `tokens.css` (colours, fonts, type scale, spacing scale, radii, widths), `chrome.css` (nav, footer, breadcrumbs, callouts, prose, tables, code) and `SiteNav.astro` / `SiteFooter.astro`. Each site deploys from its own folder, so `node packages/site-theme/sync.mjs` copies the files into `landing/`, `web-docs/` and `web-blog/`; `sync.test.ts` fails when a copy drifts. CI path filters run the three site jobs when the package changes.

- Landing: `CatalogLayout` three columns (grouped sidebar with 40px rows, 800px content, on-this-page), display h1, 19px body, 96-112px between sections, tinted callouts. Header rewritten on the shared nav classes (docs and blog links added).
- Docs: Starlight overridden (Header, PageTitle, PageFrame) with the shared nav, breadcrumbs, lead from the page description, restyled sidebar, TOC, tables, code and asides; dark only. New home: huge "docs", search field opening Pagefind (`/` focuses it), pixel-landscape band, three numbered start cards, directory of every section.
- Blog: dark, wide index rows, post page with posts sidebar, TOC from headings and mono byline; single Shiki theme.

Kept: URLs, content, meta, JSON-LD, sitemaps, homepage design (only the header changed). Mono is Fragment Mono, already loaded everywhere. The landing footer keeps its own layout; docs and blog use the shared footer. Discarded: a workspace package (would change the root lockfile) and importing across folders (breaks per-folder deploys).
