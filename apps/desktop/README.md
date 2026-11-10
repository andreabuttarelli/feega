# Feega desktop

Electron app for macOS (ADR 0021) running feega in local mode: a bundled node server per open
`.feega` file, no account. `FEEGA_URL=<url>` runs the old shell over a hosted app instead.

```bash
cd apps/desktop
npm install
npm test
npm run stage:server -- --arch=arm64       # builds the app (build:node) and stages server/
FEEGA_SERVER_ROOT=$PWD/server npm start     # dev run on the staged server
npm run build:mac:arm64                     # dist/feega-<v>-mac-arm64.{dmg,zip}, ad-hoc signed
npm run build:mac                           # arm64 + x64
```

Unsigned on purpose: no Apple Developer ID, `afterPack` ad-hoc signs. Install steps for users:
`web-docs/src/content/docs/desktop/install-macos.md`. Release: the `desktop` job in `.github/workflows/app-release.yml`, same version as npm `feega`.
