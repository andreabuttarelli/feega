# web-docs refreshed for docs.feega.app

Pages still described the old social product: brand hierarchy, `brands`
and `products` CLI commands, ad/post tables. They now describe the canvas.

- New: REST API overview (hand-written from `src/routes/api/v1`), Spend
  limits, canvas versions in Versions.
- Removed: the generated "REST API contracts" page. It read
  `BRAND_ENDPOINTS`, so it listed only brand-scoped routes.
- `.feega` export (PR #1318) not documented: the PR is still open.
- Theme: feega greys and blue accent (`DESIGN.md`), radius scale, 16px
  mobile gutter, scrollable tables. Search, copy buttons and the
  persisted light/dark toggle are Starlight's own.
- `web-docs/vercel.json` for a Vercel project rooted at `web-docs`.
- New rule in CLAUDE.md/AGENTS.md: docs and a feature video ship with
  every user-facing change.
