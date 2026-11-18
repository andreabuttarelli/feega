# `build:node` no longer bundles Playwright

`local-dev-server.ts` imported `playwright` by literal specifier for the live poster screenshot.
Playwright is not a runtime dependency, so adapter-node (which only externalises `dependencies`)
bundled it and failed on `node_modules/fsevents/fsevents.node`. That broke `npm run build:node`,
`npm run local` and the desktop app's bundled server.

The specifier is now a constant (`PLAYWRIGHT`), so Rollup cannot resolve it at build time and Node
does at runtime. When it is absent (the desktop stage installs only `dependencies`) the poster
request answers 400 with an install hint instead of a bare `ERR_MODULE_NOT_FOUND`.

Guard: `no-static-playwright.test.ts` (fast) and a CI step running `npm run build:node`.

Rejected: `external` in `vite.config.ts` (tried, no effect: adapter-node re-bundles the server with
its own Rollup run), and adding playwright to `dependencies` (ships Chromium tooling to every install).
