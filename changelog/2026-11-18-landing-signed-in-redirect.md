# feega.app sends a signed-in visitor to the app, once

The app's Supabase session lives in host-only cookies on `oh.feega.app`
(`sb-<ref>-auth-token`, chunked `.0`/`.1`, no `Domain`): `@supabase/ssr` defaults in
`src/hooks.server.ts` and `src/lib/supabase/client.ts`. feega.app never receives them, so a
Supabase client on the landing would always see a signed-out visitor.

The app now mirrors "a session cookie is present" into `feega_signed_in=1` on `Domain=feega.app`
(`syncSignedInHint`, `src/lib/server/signed-in-hint.ts`), set on the first request with a session
and deleted on the first request without one. No token: it is a hint, the app validates the real
session after the redirect.

The landing reads it:

- `/` carries an inline head script (`FIRST_VISIT_SCRIPT`, `landing/src/lib/site/signed-in.ts`)
  that redirects to the app before paint, only on the first visit (localStorage
  `feega_entered_app`), never for crawlers or link previews, never with `?stay`, and not at all if
  localStorage is unavailable. The landing is prerendered, so this cannot be decided server-side.
- The header and footer logos point to the app for a signed-in visitor.

Rejected: sharing the auth cookies on `.feega.app` (every subdomain would receive the refresh
token, every user signed out once); a credentialed CORS call to the app (a round-trip before the
landing can paint).
