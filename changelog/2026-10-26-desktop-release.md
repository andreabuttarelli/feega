# Desktop app: release pipeline and auto-update

The Electron shell (#1331) built only unsigned local packages. Now:

- `desktop-v*` tag → `.github/workflows/desktop-release.yml` builds
  macOS dmg/zip (arm64 + x64), Windows NSIS, Linux AppImage/deb.
- Signing/notarisation read `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`,
  `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`; absent → unsigned.
- electron-updater, generic provider on the rolling `desktop-latest`
  release. Rejected the GitHub provider: it reads `/releases/latest`,
  which the CLI installer also owns (`cli-v*`).
- macOS auto-update needs a signed build (Squirrel.Mac).
- Old assets accumulate on `desktop-latest`; prune when it matters.

## Frameless window

- No title bar, no reserved band: the UI starts at y=0. Window controls
  float over the app's own 48px bar (canvas bar, sidebar wordmark row),
  centred on it: macOS traffic lights at (16, 17), Windows/Linux
  `titleBarOverlay` 48px, theme-coloured. Bars get 80px left (mac) or
  140px right (overlay) and are the drag regions; controls are no-drag.
  All rules in `src/lib/styles/desktop-window.css`.
- `app.html` sets `data-window="mac"|"overlay"` only when the UA has
  `FeegaNative/` and `Electron/`; Capacitor and browsers untouched.
- Marketing routes (`/(site)`, `/(public)`) redirect to `/app` in the
  desktop shell via one table in `hooks.server.ts`; `/changelog` and
  `/docs` links are hidden. Legal links are absolute `feega.app` URLs
  and already open in the system browser.
- Icon rebuilt from `static/icon-512.png` (was 256px).
