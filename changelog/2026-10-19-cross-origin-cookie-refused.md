# A cross-origin request is never signed in by its cookie

Follow-up to the static build (#899). The bundle origins get CORS, so a request from them must be
authenticated by its bearer only. `sessionSourceOf` (`$lib/server/bearer-session.ts`) decides once
per request: a bearer wins; a request with no `Origin`, or the page's own origin, uses the
session cookie; any other origin is signed out, and `locals.supabase` sees no cookies either, so
a route that queries through it directly cannot act as the user.

CORS never sends `access-control-allow-credentials` and never a wildcard origin; a test pins both.
