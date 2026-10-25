# Native shells: build them in CI, document them

The Capacitor (iOS/Android, ADR 0018) and Tauri (desktop, ADR 0009) shells already existed but no
CI built them, so a broken shell was found only by hand. `.github/workflows/native-apps.yml` builds
the unsigned iOS simulator app, the Android debug APK and the Tauri desktop bundle on macOS,
Windows and Linux on every change under `apps/`. Docs gain an "Apps" page.

Rejected: Electron for desktop (ADR 0009); a separate native UI (ADR 0018). Running gpu-core
natively under a transparent WebView is planned in the PR, not built here.
