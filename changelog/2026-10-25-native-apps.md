# Desktop moves to Electron; native shells build in CI

ADR 0021 replaces the Tauri desktop shell (ADR 0009) with Electron in `apps/desktop`: same
routing (hosted URL, `FeegaNative/` user agent, external links to the browser, `feega://auth`
deep link, single instance), now in `routing.cjs` with `node:test` cases ported from the Rust
ones. Reason: one Chromium engine on every desktop, and the canvas will move to native gpu-core
anyway. Cost: ~265 MB app, ~3x memory.

Android gets the user agent and `feega://auth` deep link iOS already had, so OAuth returns into
the app. `.github/workflows/native-apps.yml` builds desktop (macOS, Windows, Linux), the iOS
simulator app and the Android debug APK, unsigned, on changes under `apps/`. Docs gain "Apps".

Removed: the Tauri project, its shell benchmark and the static `bundle` mode on desktop.
Left for later: the Tauri branch of `src/lib/native-bridge.ts` and `tauri://localhost` in
`api-cors.ts` are now unused.
