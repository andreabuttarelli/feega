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
