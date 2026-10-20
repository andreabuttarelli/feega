# One native bridge for Tauri and Capacitor

`src/lib/native-bridge.ts` replaces `store-purchases.ts` and the Tauri-only invoke in
`apple-sign-in/native.ts`. It answers the page's four native needs: Apple authorize, store
purchase/restore, share and haptic. Tauri gets IPC (`plugin:apple-sign-in`, `plugin:feega-iap`), and
Capacitor gets `FeegaAppleSignIn`, RevenueCat `Purchases` (configured with
`PUBLIC_REVENUECAT_APPLE_KEY`, `app_user_id` = org), `Share` and `Haptics`. Outside a native
shell the bridge is null and nothing changes.

Wired: login Apple button, StorePaywall, canvas share link (system sheet button in the shell),
timeline snap and long-press haptics (`navigator.vibrate` does not exist in WebKit).

Mobile shell: `@capacitor/share` and `@capacitor/haptics` installed. `npm run bundle` loads the
`build:spa` output from `capacitor://localhost` (`FeegaWebSource`). Hosted stays the default
until the static build has media signed URLs and client-side login.

The iPad "500 Internal Error" seen on 2026-10-19 11:33 UTC: Vercel had no function error for that
window, and three fresh installs loaded the login page. It was not reproduced and nothing here
fixes it.
