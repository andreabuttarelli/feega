# Feega desktop

Electron app for macOS (ADR 0021) over the hosted app (`https://oh.feega.app`, override with
`FEEGA_URL=<url>`): login, OAuth through the system browser back via `feega://auth/callback`.
Opening a `.feega` file switches to local mode: a bundled node server for that file, no account.

```bash
cd apps/desktop
npm install
npm test
npm run stage:server -- --arch=arm64       # builds the app (build:node) and stages server/
FEEGA_SERVER_ROOT=$PWD/server npm start     # dev run on the staged server
npm run build:mac:arm64                     # dist/feega-<v>-mac-arm64.{dmg,zip}, ad-hoc signed
npm run build:mac                           # arm64 + x64
```

Staging installs the root dependencies, then `scripts/prune.cjs` keeps only the files `@vercel/nft`
traces from the server build (plus the ffmpeg binary), without source maps or precompressed copies.

Unsigned on purpose: no Apple Developer ID, `afterPack` ad-hoc signs. Install steps for users:
`web-docs/src/content/docs/desktop/install-macos.md`. Release: the `desktop` job in `.github/workflows/app-release.yml`, same version as npm `feega`.
