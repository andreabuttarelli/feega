# Sign-in, OAuth return and sign-out inside the native bundle

The web login stays as it is (server actions, cookie session). The bundle has no server, so:

- `src/hooks.ts` `reroute`, in the bundle only, serves `/login`, `/auth/callback` and
  `/auth/signout` with client pages under `/auth/native/` (`bundleAuthRoute`). Every existing
  link and redirect to `/login` (including the API's 401 handling) lands on the bundle sign-in
  without changing.
- `/auth/native`: email/password sign-in and sign-up and Google/GitHub OAuth through
  `@supabase/ssr`'s browser client (`$lib/auth/bundle-session.ts`). OAuth returns to
  `feega://auth/callback?next=…`, which both shells already turn into `<app>/auth/callback?code=…`;
  there the callback page exchanges the code with the PKCE verifier the WebView holds.
  `next` only accepts in-app paths.
- Sign-out forms (`action="/auth/signout"`, sidebar, canvas menu, profile) get `signOutForm`: in
  the bundle the submit goes to the client sign-out page (`signOut({ scope: 'local' })`, as the
  server route), on the web it posts as before. `/auth/native` redirects to `/login` on the web.

Not covered yet: Sign in with Apple in the bundle (the Tauri and Capacitor plugins differ), the
CLI/MCP consent flows (they run in a system browser, on the web), invites and onboarding params.
`feega://auth/callback` must be on Supabase's redirect allow-list (not verifiable from here).

Verified with `scripts/spa/login-smoke.mjs` on a built bundle: signed out → `/login` form;
email/password → `/app` with projects; sign-out → back to the form, still signed out after a
reload; Google asks Supabase for `redirect_to=feega://auth/callback?next=%2Fapp`.
