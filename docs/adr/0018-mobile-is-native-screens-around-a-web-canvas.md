# Mobile is native screens around a web canvas, in a Capacitor app

Status: accepted (2026-10-19). Phase 1 built for iOS/iPadOS; Android is a scaffold.

Context: ADR 0009 ships one Tauri shell over the hosted app for every platform. On the desktop
that holds. On iPhone and iPad a WebView of the whole app feels like a website: lists scroll like a
page, navigation has no system back gesture, text fields zoom, and the App Store asks more of an app
than a wrapped site (guideline 4.2). The canvas and the motion editor are the opposite case: tens of
thousands of lines of Svelte and WebGPU that would cost months to rewrite and must stay one product
with the web.

## Decision

**Phones and tablets get a Capacitor app (`apps/mobile`) whose root is native navigation; only the
canvas and the motion editor run in a WebView.** Tauri stays for macOS and Windows.

```
SwiftUI (Jetpack Compose on Android)                     WebView (Capacitor bridge)
login ─► projects ─► canvases ─► open ──── cookies ────► /p/<id>/c/<id>   (canvas, editor)
  │          │           │                                      │
  │          └── GET /api/v1/me/projects                         back ◄─ reads cookies back
  │                      GET /api/v1/projects/<id>/canvases     (adopts a refreshed session)
  └── Supabase /auth/v1/token (password | id_token)
```

| Screen | Where | Why |
|---|---|---|
| Login, home, projects, canvases | native | lists and forms: the cheapest place to look native |
| Project settings, team, profile, settings | native (phase 2) | forms over existing bearer endpoints (`/api/v1/me/projects/<id>/settings`, `/api/v1/orgs/<id>/team`) |
| Credits / billing | native (phase 2) | RevenueCat paywall is native anyway (ADR 0017) |
| Canvas | WebView | GPU canvas, realtime, chat: one implementation with the web |
| Motion editor | WebView | same; its export pipeline runs in the page |
| Templates, gallery, motion videos list | WebView until proven otherwise | grids of live previews rendered by the web player; a native copy would need the player too |

- **Auth is native and token-based.** The app calls Supabase GoTrue directly
  (`grant_type=password`, `refresh_token`, `id_token` for Sign in with Apple, per ADR 0015), stores
  the session in the Keychain and sends `Authorization: Bearer` to `/api/v1` (the dialect of ADR
  0014). Sign in with Apple follows ADR 0015's visibility rule: hidden in production builds until
  the Apple config exists.
- **One session, no second login.** Before a WebView screen opens, the app writes the session as
  the cookie `@supabase/ssr` reads (`sb-<ref>-auth-token`, `base64-` + base64url, chunked at 3180
  characters) into the WebView's cookie store, host-only on the web origin. The page's SSR and
  browser client both see a signed-in user. On back, the app reads the cookie again and adopts it
  when it is newer: the page may have rotated the refresh token, and keeping the old one would sign
  the user out at the next refresh (refresh-token reuse revokes the family).
- **The WebView is a `CAPBridgeViewController`** with `serverURL` = web origin and `appStartPath`
  = the page, user agent suffix `FeegaMobile/1`. Capacitor gives plugins (RevenueCat, push, a perf
  probe) one bridge for both platforms. Web content process termination is logged and the page
  reloaded, never left white.
- **Contract, not hand-copied types.** Response shapes live as zod schemas in
  `src/lib/api/mobile-contract.ts`; the endpoints are typed by them and their route tests parse
  every answer with them. `npm run mobile:contract` writes `apps/mobile/contract/api.schema.json`;
  a vitest fails when the file is stale, and a Swift test fails when a Swift model misses a field
  the schema requires. Kotlin gets the same test when Android starts. Generating Swift/Kotlin
  from the schema (quicktype) is the next step once there are more than a handful of models.
- **Offline: last good answer, then the network.** Each list is cached as its JSON in Caches and
  shown at once, then refreshed; a failed refresh keeps the list and says "offline". Sign-out
  clears it. The canvas keeps its own local-first behaviour inside the page.
- **Billing**: RevenueCat Capacitor plugin installed; `app_user_id` = org id after login (ADR 0017).
  Purchases and restore are wired with the native paywall in phase 2.
- **Push** later, through `@capacitor/push-notifications`.

## Rejected: every screen as a bundled web page

One codebase and instant parity, but every list, form and transition would be a web imitation of
native, the reason this ADR exists; and the dashboard pages are built for a desktop pointer.
Bundling them would also need the static client build ADR 0009 (d) still lacks. The native share is
deliberately the cheap part (lists and forms over existing endpoints); the expensive surfaces are
not duplicated.

## Rejected: a fully native app

The canvas and editor would be a second implementation of the product's core, drifting from the web
on every PR.

Consequences: three clients read `/api/v1` (web, CLI, mobile). A mobile screen needs its endpoint
first, with a schema in the contract. The web origin must allow `FeegaMobile` the same as a browser;
nothing on the server branches on it yet.
