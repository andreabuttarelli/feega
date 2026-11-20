# Attach to a running dev server by URL

Feega Inspect can now be pointed at a server that is already running: command "Feega: Open from
URL…" in VS Code, `npx feega --url <address> [dir]` in the terminal, and an address field in the
panel when no server runs.

- `session.attachUrl` (`inspect/src/host/session.ts`) attaches through `devProxy` via
  `attachDev` (`dev-server.ts`). It never spawns and never kills the server: stopping closes only
  the proxy.
- URL to folder: one app root wins; with several, the first `data-feega-src` file in the page HTML
  picks it (`attach-url.ts`); otherwise the platform's `chooseApp` asks (QuickPick in VS Code, a
  numbered list in npx).
- A page whose layers carry no source gets "This page has no source info" with two actions: add
  the plugin (reuses `planInit` from `cli/lib/init.ts`, so `feega init` and the panel write the
  same config edit; dependencies still need installing) or let Feega start the server.
- Discarded: reading the page HTML for framework metadata. Svelte/React/Vue stamps are made in the
  browser, so the HTML only helps when the server already tags it.
