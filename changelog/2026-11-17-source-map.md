# Elements know the file:line that wrote them

PR 2 of "design in your codebase". The canvas needs to go from a clicked element in a live frame
to the source to edit. New package `packages/source-map` (`@feega/source-map`, not published yet):

- `inject.ts`: one transform, a registry by extension (`.jsx`, `.tsx` via `@babel/parser`; `.svelte`
  via `svelte/compiler`, loaded lazily so React apps need no Svelte). Host elements only get
  `data-feega-src="file:line:col"`; components, fragments, `motion.div` do not.
- `vite.ts`: `apply: 'serve'`, `enforce: 'pre'`, so production builds never see it; injects the bridge
  through `transformIndexHtml`.
- `next.ts`: `withFeegaSource(config)` adds a webpack `pre` loader and prepends the bridge to the
  `main-app`/`main` client entries, only when `dev`. Chosen over SWC (a Wasm plugin pinned to
  the SWC ABI of each Next release) and Babel (disables SWC). Turbopack is not covered.
- `runtime.js` / `bridge.js`: plain JS so webpack and Vite load them from outside the app without
  transpiling. `feega:inspect` by point or selector returns source, design styles, truncated
  outerHTML and the component boundary (nearest ancestor with another file).

`feega init` (`cli/lib/init.ts`, pure; `cli/commands/init.ts`, IO) detects Next before Vite,
edits the config and `devDependencies`, prints a line diff, asks, is idempotent, `--dry-run`.

Compared with usegui (brijr/gui): it reads React 19's `_debugStack` through dev source maps and the
DevTools protocol, so no transform, but React-only and approximate on Next webpack. A build-time
attribute works for Svelte and server components and needs no debugger.

Tests: transform units; `npm run test:source-map` (opt-in, installs the fixtures) boots Vite+React
and Next 15+Tailwind dev servers, clicks through the bridge in Chromium, and checks production
builds hold no `data-feega-src`.
