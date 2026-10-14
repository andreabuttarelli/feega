# Native shell skeleton (Tauri 2)

Second step of ADR 0009. `apps/native/` holds a Tauri 2 shell that loads the hosted app on macOS,
Windows, iOS and Android. Outside the npm workspace, the web build and CI.

- Start URL from `FEEGA_URL` (runtime, then compile time), default production; `bundle` loads a
  local `bundle/index.html`, the slot for a static build if the ADR's option (d) is ever taken.
- OAuth: Google refuses embedded WebViews. The login action now picks the return address by user
  agent (`src/lib/native-shell.ts`): `FeegaNative/` → `feega://auth/callback`, else the web
  callback. The shell opens off-origin navigations in the system browser and maps the deep link
  back to `/auth/callback?code=…` in its WebView, which holds the PKCE verifier cookie. No new
  endpoint. Requires `feega://auth/callback` in Supabase's redirect allow-list.
- The user agent is per platform (an iPhone UA on iOS) so the server keeps serving the mobile
  layout; a fixed desktop UA plus desktop min size rendered the login at 800px on the phone.
- iOS and Android projects generated (`src-tauri/gen/`). iOS simulator build runs unsigned.
- `bench/` measures the #553 canvas pan/zoom harness inside Tauri, Electron, Chromium and WebKit
  (`cargo build --features bench` injects the loader; the product build has no injection).

Verified: routing unit tests (cargo), login route tests, `.app` 10.4 MB, `open feega://auth/callback?code=…`
reaches `<FEEGA_URL>/auth/callback?code=…`, iOS simulator shows the mobile login.
