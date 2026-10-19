# The mobile shell runs the static bundle

The Capacitor app now serves `build-spa` from `capacitor://localhost` by default (`npm run bundle`
fills `www`, which is not committed). The hosted app stays available with `FeegaWebSource = hosted`.

Two defects, each found on the simulator and pinned by a test first:

- **Sign-in was forgotten.** `@supabase/ssr` keeps the session in `document.cookie`, and a
  `capacitor://` page has no cookies. Sign-in returned ok and the next read found no session, so
  the app stayed on `/login`. Chromium on `http://localhost` (the spa smoke) has cookies, so the
  smoke never saw it. In the bundle the browser client is now plain `supabase-js` with
  `localStorage`, PKCE, and no URL detection (the callback page does the exchange).
- **The shell opened on the marketing homepage.** On the web the server redirects `/`; the bundle
  has no server. `/` now redirects to `/app` in the bundle.

OAuth returns on `feega://auth/callback`, which the shell maps to
`capacitor://localhost/auth/callback` (Swift test). Content inset is back to `never`: the bundle
pads for the safe area itself.

Checked: `login-smoke.mjs` and `smoke.mjs` against a local API, plus iPhone 15 Pro (iOS 17.2) and
iPad Pro (18.4) simulators: sign-in, dashboard, canvas.
