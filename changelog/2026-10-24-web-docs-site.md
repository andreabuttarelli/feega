# Docs site in web-docs/

**Before:** product docs lived in `src/routes/(public)/docs` (i18n strings of the old social
autopilot product) and loose markdown under `docs/` and `cli/docs/`.

**Now:** `web-docs/` is a standalone Astro + Starlight project (own `package.json`, not part of
the app build, not matched by the app's vitest globs). `npm --prefix web-docs run gen|dev|build`.
Hand-written guides (getting started, canvas, motion, AI, integrations, architecture) plus pages
generated from the code so they cannot drift: MCP tool list (`tools/list` of `cli/mcp`), the edit
op catalogue, `packages/api-contracts` endpoints, the shortcut registry, export formats, the
public changelog. `docs/SELF_HOSTING.md` and `docs/adr/` are copied at gen time.

**Decisions:** the generator runs under vitest with the app's own `vite.config.ts`
(`web-docs/scripts/vitest.gen.config.ts`): `vite-node` cannot start the SvelteKit plugin, and
the catalogue imports `$lib`/`$app`. So the docs CI job runs the root `npm ci` too. Generated
output is git-ignored. Claims not confirmed in code are marked **Unverified** in the pages.
No public changelog entry: nothing changes inside the product. Not deployed: needs its own
Vercel project rooted at `web-docs`.
