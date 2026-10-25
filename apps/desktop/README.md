# feega desktop

Electron shell for macOS, Windows and Linux (ADR 0021). It loads the hosted app; no UI of its own.

```bash
cd apps/desktop
npm install
npm test                                   # routing (node:test)
FEEGA_URL=http://localhost:5173 npm start
npm run build:mac                          # dist/mac-arm64/feega.app, unsigned
npm run build                              # this OS's installers, unsigned
```

Deep links (`feega://auth/callback?code=…`) need the packaged app registered with the OS: run it
once from `dist/`. Supabase must list `feega://auth/callback` in its redirect URLs.

## Before a release

| Need | For |
|---|---|
| Apple Developer ID cert + notarisation (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`, `CSC_LINK`) | macOS outside the store |
| Windows code-signing cert (OV/EV or Azure Trusted Signing) | SmartScreen |
| Bundle id `app.feega.desktop` confirmed | all |
| Update feed (electron-updater) | auto-update |
