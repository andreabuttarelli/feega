# The native app is one Tauri 2 shell that loads the hosted app, over a PWA baseline

Context: feega must be installable on macOS, Windows, iOS and Android. The app is SvelteKit with
server routes (form actions, `/api/v1`, `/auth/callback`, SSR pages) deployed on Vercel: there is
no static build to bundle, and none is planned. Whatever the shell, it shows `oh.feega.app` in a
system WebView.

Options weighed:

| | (a) Tauri 2 everywhere | (b) Capacitor mobile + Tauri/Electron desktop | (c) PWA only |
|---|---|---|---|
| Codebases | one Rust crate, one config | two shells, two plugin ecosystems | none |
| Remote URL | `WebviewUrl::External` | `server.url` (documented as dev-only, works in prod) | native |
| Deep link `feega://` | `tauri-plugin-deep-link`, desktop + mobile | Capacitor App plugin + a desktop one | no custom scheme |
| Share sheet, camera roll, files | plugins (dialog, fs, share via community) or Swift/Kotlin plugin | richest plugin catalogue | Web Share, `<input type=file capture>` |
| Push | community plugin or own Swift/Kotlin plugin | `@capacitor/push-notifications` | Web Push (iOS 16.4+, installed only) |
| Size | ~10 MB desktop, system WebView | Electron ~150 MB | 0 |
| Store review 4.2 | needs native features | same | not in store |

Decision: **(a) Tauri 2 for all four platforms, PWA as the baseline.** Default confirmed.

- One shell. Capacitor's real edge is its mobile plugin catalogue; the features we need first
  (deep link, external browser, dialog, notifications) exist as official Tauri 2 plugins, and the
  rest is a small Swift/Kotlin plugin Tauri 2 supports natively. Two shells would double signing,
  CI and updates for no feature we need today.
- Electron is out: it ships Chromium (+150 MB) to show a site, and gives nothing over WKWebView on
  macOS that matters to us except Chromium parity.
- The PWA is not an alternative but the floor: same manifest, icons and safe areas serve the
  shell, and users who never install a binary still get an installable app.

Auth. Google refuses OAuth in an embedded WebView (`disallowed_useragent`), and Apple prefers the
system browser. Flow:

1. The shell sets a user agent containing `FeegaNative`.
2. The login action sees it and asks Supabase for `redirectTo = feega://auth/callback?...`
   instead of `https://<host>/auth/callback`. The PKCE verifier cookie is set in the WebView.
3. The shell opens every navigation off the app host in the system browser.
4. Supabase redirects the browser to `feega://auth/callback?code=…`; the OS hands it to the shell
   (`tauri-plugin-deep-link`), which navigates the WebView to `https://<host>/auth/callback?code=…`.
5. The existing callback exchanges the code with the verifier the WebView already holds.

No new endpoint, no token passes through the URL beyond the one-time code. `feega://auth/callback`
must be on Supabase's redirect allow-list. Later, iOS/Android should move to universal/app links
(`https://oh.feega.app/auth/callback` verified), which cannot be hijacked by another app
registering `feega://`; PKCE already makes a stolen code useless without the verifier.

WebView limits:

- WKWebView is Safari: the canvas pan/zoom fix in #553 applies as is; anything that is slow in
  Safari is slow in the macOS and iOS shells. WebView2 (Windows) and Android WebView are Chromium.
- Autoplay: muted inline video plays; sound needs a gesture. Same rule as Safari today.
- Video export through WebCodecs: WKWebView follows Safari's support; no regression versus web.
- Service worker: not available in WKWebView for non-bound domains on iOS; the shell must not
  depend on it. It caches only the static shell anyway.

App Store guideline 4.2 (minimum functionality): a WebView over a website is rejected. Before
submitting iOS we add what the browser cannot do: share-sheet export of a rendered video to
Photos, camera-roll picker into the asset library, push notifications for finished renders, and
`feega://` / universal links. Mac App Store is optional: notarised direct download needs no review.

Updates: the UI is the hosted app, so a deploy updates every shell. Only the shell binary needs
`tauri-plugin-updater` (desktop, signed update feed) or store releases (mobile), rarely.

Accounts and signing the user provides: Apple Developer Program (99 USD/yr; Developer ID cert for
macOS notarisation, distribution cert + provisioning for iOS), Google Play Console (25 USD once,
upload key), Windows code-signing cert (OV/EV or Azure Trusted Signing), a Tauri updater key pair,
and the bundle id `app.feega.desktop` reserved in both stores.

Consequences:

- `apps/native/` holds the shell, outside the npm workspace and outside CI until it ships.
- The server knows one thing about the shell: the `FeegaNative` user-agent mark, read in one module.
- The shell never exposes Tauri IPC to the remote origin (no `remote` capability) until a native
  feature needs it; then only that command, only for the app host.
