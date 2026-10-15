# Web login runs on the client, like the bundle

Before: the web login posted to `/login` form actions (`login`, `signup`, `reset`, `google`,
`github`) that signed in on the server; the bundle had its own client-only flow
(`$lib/native/native-auth.ts`). Two implementations of the same login.

Now one: `$lib/login/client-auth.ts` + `auth-enhance.ts` serve both. Email/password signs in
with the browser Supabase client; sign-up and reset go through `/api/v1/auth/signup|reset`;
OAuth starts in the browser with PKCE.

What keeps the hosted cookie session: on the web the browser client is `@supabase/ssr`'s, which
stores the session and the PKCE verifier in cookies. Server-rendered pages (share, render,
`/auth/callback`, `/auth/confirm`) read them as before. After sign-in the web reloads `/login`
with its query; its server load already routes to the MCP consent resume, the CLI callback, the
invite or home, so that routing is not duplicated on the client. The bundle keeps
`/api/v1/me/landing`.

OAuth return: web → `<origin>/auth/callback` (server exchange, verifier cookie); hosted page in
the native shell or the bundle → `feega://auth/callback`. `cli_port`, `cli_state`,
`invite_token` ride on the callback URL.

Removed: the `/login` form actions and `native-oauth.route.test.ts`; their cases moved to
`client-auth.test.ts`, the login load test and `tests/e2e/login-oauth.spec.ts`.
