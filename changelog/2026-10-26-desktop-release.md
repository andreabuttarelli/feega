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

- No native title bar; window controls stay. macOS: traffic lights at
  (12, 8) inside the strip. Windows/Linux: `titleBarOverlay` 28px high,
  colours follow the system theme. Cmd/Ctrl+Q/W/M via the default menu.
- `app.html` marks `data-window="frameless"` only when the UA has both
  `FeegaNative/` and `Electron/` (Capacitor stays out). Not
  `data-shell`: the root layout already owns it (app/site).
- `safe-area.css`: a fixed 28px drag strip, and `--safe-top` = 28px so
  `.safe-shell` layouts start below it instead of under it.
- Icon rebuilt from `static/icon-512.png` (was 256px).
