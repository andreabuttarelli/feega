# Mobile is the web UI in a Capacitor shell, with a few native capabilities

Status: accepted 2026-10-19. It replaces this ADR's first version, also from 2026-10-19 (native
SwiftUI lists around a web canvas). That version shipped in #891 and was removed the same day,
by the user's decision.

Context: ADR 0009 ships one Tauri shell for every platform. On iPhone and iPad we want the store
presence and the native capabilities Tauri mobile doesn't give us cheaply (RevenueCat, Sign in
with Apple, push), and the web UI already handles phones: sheets, safe areas, pinch lock.

## Decision

**`apps/mobile` is a Capacitor app whose only screen is the feega web UI. Everything runs in that
one WebView.** Tauri stays for macOS and Windows.

```
FeegaBridgeViewController (CAPBridgeViewController)
  loads  bundled static build ─ until it lands ─► https://oh.feega.app
  UA     … FeegaNative/mobile-<version>   (native-shell.ts: OAuth returns on feega://, store
                                            billing channel, Apple button visibility, no cookie
                                            banner: necessary cookies only, as no tracking is opted in)
  feega://auth/callback?… ─► <web>/auth/callback?…   (DeepLink)
  plugins FeegaPerf, FeegaAppleSignIn (flag), RevenueCat (installed), push (later)
```

- **One WebView, one session.** The web app signs in as it does in a browser; nothing is handed
  between native and web.
- **Bundled build (default since 2026-10-19).** `npm run bundle` (apps/mobile) builds `build:spa`
  into `www`; Capacitor serves it from `capacitor://localhost` with the `index.html` fallback, and
  `/` opens `/app`. `capacitor://` has no cookies, so in the bundle the browser Supabase client keeps
  the session in `localStorage`. OAuth returns on `feega://auth/callback`, mapped to
  `capacitor://localhost/auth/callback` (rerouted to `/auth/native/callback`). `window.open` of
  public pages goes to the system browser. `FeegaWebSource = hosted` loads the hosted app instead.
- **One page-side bridge.** `src/lib/native-bridge.ts` picks Tauri IPC or Capacitor plugins;
  login (Apple), the store paywall, share and haptics call it, never a shell API directly.
- **Native code is only what Capacitor can't do from the page:**
  - `FeegaPerf`: app memory footprint (`task_vm_info.phys_footprint`), and recovery when WebKit
    kills the web content process (logged, counted, page reloaded; never a dead white view). A
    debug overlay (Settings app → feega → Performance probe) shows reveal time, fps, long frames
    and footprint, with a copyable report.
  - `FeegaAppleSignIn.authorize({ nonce })` → `{ identityToken }` for ADR 0015's
    `signInWithIdToken`. Registered only when `Info.plist FeegaAppleSignIn = on`.
  - RevenueCat Capacitor plugin installed. ADR 0017 sets `app_user_id` = org id. The page calls
    it once `NATIVE_STORE_BILLING=on` and the store products exist.
- **Min iOS 16.** Xcode 26 debug builds crash on iOS 17 runtimes unless `SwiftUICore` is
  weak-linked. `scripts/wire-xcode.rb` adds the flag.

## App Store guideline 4.2 (minimum functionality)

A WebView of a website is at risk. These native capabilities are what make it an app:

| Capability | State |
|---|---|
| Sign in with Apple (native sheet) | plugin built, behind flag (needs paid account + Supabase Apple config) |
| In-app purchases and restore (StoreKit via RevenueCat) | wired via `nativeBridge`; Debug buys from `Products.storekit` through `FeegaStoreKit` until `PUBLIC_REVENUECAT_APPLE_KEY` is set; needs store products, `NATIVE_STORE_BILLING=on` |
| Push notifications (generation finished, invites) | later, `@capacitor/push-notifications` |
| Share sheet | wired: canvas share link (`systemShare`); exported files still use Web Share |
| Haptics | wired: timeline snap and long-press menus (`haptic`), native in the shell |
| Offline: bundled UI, local-first canvas edits | with the static build |
| Process-death recovery, memory probe | built |

## Rejected

- **Native screens around a web canvas** (this ADR's first version). It looks most native, but
  it duplicates every list and form per platform (Swift, then Kotlin). It also hands the session
  between two auth stacks and has to keep the rotated refresh tokens in sync. The user chose the
  web UI everywhere.
- **A fully native app.** It would be a second implementation of the canvas and editor.
- **Tauri mobile.** Its mobile plugin story for StoreKit, Apple sign-in and push is thinner than
  Capacitor's, and every plugin would be ours to write.

Consequences: native work is limited to plugins. Screen work happens once, in the web app. The
bearer list endpoints added for the native lists (`/api/v1/me/projects`,
`/api/v1/projects/<id>/canvases`) stay: the CLI uses them.
