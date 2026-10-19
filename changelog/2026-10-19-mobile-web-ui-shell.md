# Mobile: web UI in the Capacitor shell, native screens dropped (ADR 0018 rewritten, renamed)

The user chose the web UI everywhere. Removed: SwiftUI login/projects/canvases, native auth
client, session cookie handoff, list cache, JSON contract export and its Swift/vitest drift
tests. Kept: the two bearer list endpoints (the CLI uses them, types now in
`src/lib/api/project-lists.ts`).

The shell loads the hosted app (static bundle later) with `FeegaNative/mobile-<v>` in the UA, maps
`feega://auth/callback` to the web callback, hosts `FeegaPerf` (footprint, process-death reload,
probe chip toggled from Settings.bundle) and `FeegaAppleSignIn` (behind an Info.plist flag).
iOS 17 launch crash fixed by weak-linking SwiftUICore. Content inset `always` so the web header
clears the status bar.

Web: no cookie banner inside the native shell (`initConsent`), so only necessary cookies apply until
the person opens cookie settings. Bearer page actions can call `auth.signOut` (account deletion
over bearer deleted the account, then answered 500).
