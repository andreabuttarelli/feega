# Sign in with Apple, local and native builds only

A "Continue with Apple" button on `/login` (sign-in and sign-up modes), Apple HIG black/white.
Hidden in production: `src/lib/apple-sign-in/visibility.ts` shows it on local hosts, and on
other non-production hosts only to the native shell with `APPLE_SIGN_IN=on`. `?/apple` and
`?/appleIdToken` answer 404 where it is hidden.

Two paths. Without Tauri IPC the button runs Supabase OAuth with `provider: 'apple'` (the native
shell already returns on `feega://auth/callback`). With the future `apple-sign-in` plugin the page
gets an identity token from the native sheet and posts it with the raw nonce to `?/appleIdToken`,
which calls `signInWithIdToken` and routes like every other login. The plugin is designed in ADR
0015, not built: it needs the Apple Developer setup first and touches the shell's capabilities.

No public changelog: invisible in production until the button is turned on.
