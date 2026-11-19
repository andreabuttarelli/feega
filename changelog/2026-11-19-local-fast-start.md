# Local mode starts without waiting on the network or on npm

Measured before touching anything (release bundle 0.1.36, all cached, Chrome already open), a warm
`npx feega` spent its time in a chain of waits: npm resolving `feega@latest` (0.3–1.3 s), the
GitHub releases check (0.15–0.75 s, 2 s when offline), the server boot (~0.6 s), the 300 ms
readiness poll, then `open` of the browser, then the first page. A new app version, which ships on
every push to `main`, also ran `npm ci` for 634 packages: 16–25 s, warm npm cache or not.

What changed:

- **Warm start never touches the network.** With a cached version the launcher starts it at once
  and checks GitHub after the server answers; a newer bundle installs in the background, quietly,
  and is used on the next start. Without a cache it still asks first (`pickVersion`).
- **The browser opens at once** on a tiny page served by the launcher itself (`loadingServer`),
  which shows the current step (download, install, start) and replaces itself with the app the
  moment the server answers. Opening the browser now overlaps the download and the server boot.
  The page polls the launcher, not the app: a cross-origin probe of the app port would need CORS.
- **Bundles stream into `tar`** while they download (`extract`), no temporary file.
- **Dependencies are shared between versions**: `~/.feega/deps/<sha of package-lock>` holds one
  `npm ci`, and each version's `node_modules` is a symlink (junction on Windows) to it. For this to
  hit, `scripts/app-bundle.sh` now seeds the stage with the root `package-lock.json`: before, each
  release re-resolved ranges and the lock differed between 0.1.35 and 0.1.36 (`@supabase/*`
  2.119.0 → 2.119.1). With the seed, two runs give the same lock, at the versions dev and CI use.
- **Installs are atomic** (`installAtomic`): built in `<dir>.tmp-<pid>-<uuid>`, marked, renamed.
  Two launchers installing the same version no longer clobber each other, and a half folder left
  by an older launcher is replaced. A killed install leaves its tmp folder behind (not cleaned).
- **The server reuses V8's compile cache** (`NODE_COMPILE_CACHE=~/.feega/compile-cache` unless
  set): importing `build/handler.js` drops from ~600 to ~450 ms. The variable reaches the server's
  children too, so a folder import's dev server also caches there.
- **Readiness poll 300 → 20 ms** in the launcher, 400 → 20 ms in the extension.
- **The VS Code extension runs its own copy of the launcher with `node`** instead of
  `npx -y feega@latest`; `vscode:prepublish` copies `npx/` into `vscode/launcher/`. From the repo it
  falls back to `../npx`. The launcher now updates with the extension; the app bundle still updates
  on its own. MCP server definitions use the same launcher.
- **Closing a canvas tab while it starts stops its server** (`childSlot`): the child was recorded
  only once ready, so a tab closed during startup left the server running.

Evaluated and not done: preloading the wasm (asked→ready is ~45 ms on loopback), warming SvelteKit
routes before the first request (the first canvas SSR costs ~400 ms of lazy module loading, the
second 3 ms; the browser asks the moment the server listens, so a warm-up would only move the same
work), skipping the `local.mjs` → `node-server.mjs` process hop (~30 ms).
