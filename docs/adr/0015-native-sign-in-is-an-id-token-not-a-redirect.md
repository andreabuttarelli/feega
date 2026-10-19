# Native sign-in hands Supabase an ID token; the redirect flow stays as fallback

Context: ADR 0009 signs in from the shell by bouncing through the system browser and back on
`feega://auth/callback`. It works, but on iOS and macOS the expected gesture is the Sign in with
Apple sheet, and App Review asks for it (guideline 4.8) once Google sign-in is offered in an app.

Decision: **the shell gets the provider's ID token natively and the page posts it to the login
action, which calls `supabase.auth.signInWithIdToken`.** Apple first; Google later on the same path.

```
button ?/apple ─┬─ no Tauri IPC ──────────► Supabase OAuth (web, or feega:// in the shell)
                └─ plugin:apple-sign-in|authorize { nonce: sha256(raw) }
                     ASAuthorizationController sheet
                   ◄ { identityToken }
                   POST ?/appleIdToken { token, nonce: raw }
                     signInWithIdToken({ provider: 'apple', token, nonce })  (sets SSR cookies)
                     routeAfterAuth → CLI callback / invite / canvas
```

- **Nonce.** The page makes a 32-byte random `raw`, gives Apple `sha256(raw)` hex, gives Supabase
  `raw`. Supabase hashes it and compares with the token's `nonce` claim: a replayed token fails.
  `src/lib/apple-sign-in/nonce.ts`.
- **Server, not browser client.** The token goes through a form action so the session lands in the
  SSR cookies and the existing `routeAfterAuth` (CLI, invite, OAuth resume) applies unchanged.
- **Fallback.** No IPC (browser, old shell, Windows, Android) → the same button runs the web OAuth
  flow with `provider: 'apple'`, which in the shell already returns via `feega://auth/callback`.
- **Visibility.** Until the Apple config exists the button is hidden in production. One table,
  `src/lib/apple-sign-in/visibility.ts`: production hosts never; local hosts always; any other host
  only for the native shell with `APPLE_SIGN_IN=on`. The actions refuse with 404 where the button is
  hidden, so a hand-made POST cannot reach Supabase either.

## The plugin (not built yet)

`apps/native/plugins/apple-sign-in`, a Tauri 2 plugin crate, separate from the shell's `lib.rs`:

- iOS: Swift `Plugin` subclass, `@objc func authorize(_ invoke: Invoke)`; builds an
  `ASAuthorizationAppleIDRequest` with `requestedScopes = [.fullName, .email]` and `nonce` from the
  args, presents `ASAuthorizationController`, resolves `{ identityToken, authorizationCode,
  fullName? }` (token is UTF-8 of `credential.identityToken`). Cancel rejects with `cancelled`.
- macOS: same in Rust via `objc2-authentication-services`, or a Swift package linked by the plugin's
  build script; presentation anchor is the main `NSWindow`.
- Capability: one remote capability, `urls: ["https://oh.feega.app/*"]` (plus `http://localhost:*`
  in dev), permission `apple-sign-in:allow-authorize` only. ADR 0009's rule: only that command,
  only for the app host.
- Entitlement `com.apple.developer.applesignin = ["Default"]` in the iOS and macOS entitlements.
- Apple returns the name only on the first authorization: the page should forward `fullName` to
  `/api/v1/me` once signed in (not built).

## Google later

Same command shape, `plugin:google-sign-in|authorize { nonce }`: iOS uses the GoogleSignIn SDK
(or `ASWebAuthenticationSession` with PKCE), Android Credential Manager; the page posts to
`?/googleIdToken` → `signInWithIdToken({ provider: 'google', token, nonce })`. Supabase needs the
iOS and Android client IDs in the Google provider's "Authorized Client IDs", and for iOS "Skip
nonce check" unless the SDK version forwards the nonce. The action becomes `?/idToken` with the
provider as a field at that point, not before.

Consequences: the remote origin gets its first IPC command, scoped to one permission; the server
trusts nothing from the shell except a token Supabase verifies against Apple's keys.
