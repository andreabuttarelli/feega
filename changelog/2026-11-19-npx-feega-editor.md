# `npx feega` opens the Feega Inspect editor in the browser

The `feega` npm package used to download and run the local infinite canvas. It now runs the
Feega Inspect editor on the app in the current folder, in the browser, with the same UI and
behaviour as the VS Code extension.

- The host was split: the editor session (`inspect/src/host/session.ts`) talks to a `Platform`
  port (`platform.ts`) with two adapters, VS Code (`vscode-platform.ts`) and Node
  (`node-platform.ts`). Messages travel by `postMessage` in VS Code and by WebSocket in the
  browser (`webview/host.ts` picks one).
- `npx/` holds the CLI only (args, a localhost server for the built webview and the socket); it
  bundles the session, the dev-server launcher and the webview into `dist/`.
- Node equivalents: open in editor via `code -g`/`$EDITOR`/printed path; settings and history
  in `.feega/` of the app; diffs via `code --diff` or two printed paths; the clear-cache prompt
  is skipped (the menu click is the confirmation).
- Discarded: keeping the old canvas bundle and the macOS app jobs in `app-release.yml`; they
  shipped the product `npx feega` no longer runs.
