# macOS desktop app runs local mode, unsigned

Before: `apps/desktop` was an Electron shell over `oh.feega.app`, with electron-updater and a
release workflow that expected Apple Developer ID secrets. Without them the mac build was
unsigned, and Apple silicon called it "damaged".

- The app bundles the node build (`build:node`, `PUBLIC_FEEGA_LOCAL=1`) and its production
  `node_modules` under `Contents/Resources/server` (`scripts/stage-server.cjs`, per arch), and
  runs `scripts/node-server.mjs` with Electron's own Node (`ELECTRON_RUN_AS_NODE`) and
  `localEnv` from `scripts/local.mjs`. One loopback port per run; switching file restarts the
  server on the same port, so the window origin never changes.
- File menu: New Canvas, Open, Save As (stop → copy → reopen), recent documents. `.feega` is a
  file association; Finder double-click arrives as `open-file`. Last file in
  `userData/state.json`, else `~/Documents/Untitled.feega`. `.env` next to the file supplies AI keys.
- The server gets the login shell's `PATH`, else a Finder launch cannot find `npm` for folder import.
- `afterPack` copies the server (electron-builder drops any `node_modules` in `extraResources`)
  and ad-hoc signs with `codesign --force --deep -s -`. `identity: null`, no hardened runtime,
  no notarisation: Gatekeeper shows "unidentified developer" instead of "damaged".
- Updates: Squirrel.Mac refuses an ad-hoc signed update, so electron-updater is gone.
  `updates.cjs` reads GitHub releases (`desktop-v*`) and offers the download page.
- Release workflow: macOS only (arm64 + x64), no secrets, uploads `SHA256SUMS.txt`.
  Windows/Linux dropped: the bundled server is staged for darwin only.
- `FEEGA_URL` still runs the old hosted shell, for development.
- Discarded: a universal build (two arch-specific `node_modules` trees do not merge); embedding
  the server in the main process (a server crash would take the window down).
