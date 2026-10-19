# feega native shell

Tauri 2 shell for macOS, Windows, iOS and Android (ADR 0009). It loads the hosted app; it has no UI
of its own. Not part of the npm workspace, the web build or CI.

## What it does

- Opens `FEEGA_URL` (default `https://oh.feega.app`). `FEEGA_URL=bundle` loads `bundle/index.html`
  instead: the static build. Read at runtime first, then at compile time.
- The bundle is `PUBLIC_API_BASE=https://<api host> npm run build:spa` at the repo root, copied from
  `build-spa/` to `apps/native/bundle/`. It calls the API with the Supabase bearer; the API answers
  `tauri://localhost` and `capacitor://localhost` across origins (`src/lib/server/api-cors.ts`).
- Sends a user agent ending in `FeegaNative/<version>`. The login action reads it
  (`src/lib/native-shell.ts`) and asks Supabase to return to `feega://auth/callback`.
- Opens every navigation off the app origin (Google, GitHub, Supabase authorize, external links)
  in the system browser.
- Turns `feega://auth/callback?code=…` into `<app>/auth/callback?code=…` in the window, where the
  existing callback exchanges the code with the PKCE verifier the WebView already holds.
- Exposes no Tauri IPC to the hosted page yet; store purchases will add only `plugin:feega-iap|purchase|restore` (ADR 0015).

## Run

```bash
cd apps/native
npm install
npm test                                   # routing unit tests (cargo)
FEEGA_URL=http://localhost:5173 npm run dev
npm run build:mac                          # src-tauri/target/release/bundle/macos/feega.app
```

Deep links on macOS only work from a bundled app registered with Launch Services (move it to
`/Applications` or run it once), not from `tauri dev`. Check with
`open "feega://auth/callback?code=x"`.

iOS and Android projects are generated in `src-tauri/gen/`.

```bash
npm run tauri -- ios build --target aarch64-sim --debug   # simulator, no signing
npm run ios:dev                                           # device, needs a team id
ANDROID_HOME=~/Library/Android/sdk NDK_HOME=~/Library/Android/sdk/ndk/<ver> npm run android:dev
```

## What you must provide before a release

| Need | For | Where it goes |
|---|---|---|
| Apple Developer Program (99 USD/yr), team id | iOS, macOS notarisation | `bundle.iOS.developmentTeam`, `APPLE_*` env in CI |
| Developer ID Application cert + app-specific password | macOS outside the store | `APPLE_CERTIFICATE`, `APPLE_ID`, `APPLE_PASSWORD` |
| Apple Distribution cert + App Store provisioning profile | iOS App Store | Xcode / CI keychain |
| Google Play Console (25 USD once), upload keystore | Android | `gen/android/keystore.properties` (never committed) |
| Windows code-signing cert (OV/EV or Azure Trusted Signing) | Windows SmartScreen | `bundle.windows.certificateThumbprint` or signCommand |
| Updater key pair | desktop auto-update | `tauri signer generate`, public key in config |
| Bundle id confirmed: `app.feega.desktop` | all stores | `tauri.conf.json > identifier` |
| `feega://auth/callback` in Supabase Auth redirect URLs | OAuth in the shell | Supabase dashboard |
| RevenueCat public SDK keys (Apple, Google) + `feega-iap` plugin | in-app purchases (ADR 0015) | plugin config; server: `REVENUECAT_WEBHOOK_SECRET`, `NATIVE_STORE_BILLING=on` |

## Benchmark

`bench/` runs the canvas pan/zoom harness of #553 inside each shell and posts fps to a local
collector. The window must be visible: a locked screen pauses WKWebView frames.

```bash
npm run dev -- --port 5191                 # repo root, dev server
node apps/native/bench/collector.cjs       # writes apps/native/bench/results.jsonl
node apps/native/bench/pw.cjs chromium     # and webkit
cd apps/native/src-tauri && cargo build --release --features bench && FEEGA_URL=http://localhost:5191/changelog ./target/release/feega
cd apps/native/bench/electron && npm i electron && npx electron main.js
```
