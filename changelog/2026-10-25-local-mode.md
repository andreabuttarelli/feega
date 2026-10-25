# Local mode: one canvas an agent drives without login

Why: an AI agent running feega on its own machine had to sign up, pass
the dashboard and run `feega login` before touching a canvas.

`FEEGA_LOCAL_MODE=1` (default in `infra/compose`, written by
`npm run setup`):

- `src/lib/server/local-mode.ts` governs the mode: the redirect table,
  the project scope check, the demo sign-in. `hooks.server.ts` only
  calls `serveLocal`.
- Pages without a session sign in as the seeded demo user (cookies, so
  browser realtime works). RLS untouched.
- `/api/v1` without a Bearer (or with the CLI placeholder `local-mode`)
  runs with the demo user's token; a `projectId`/`canvasId` in params,
  query or JSON body other than the local ones is a 403.
- The seed creates project `local`/canvas `Local` instead of the demo
  project, so default-project tools land there.
- `/api/v1/version` reports `localMode`; the CLI uses it to skip
  `feega login` against a local URL.
- `init` in hooks refuses to start with a non-local `PUBLIC_APP_URL` or
  on Vercel.

Discarded: a per-route check in every `/api/v1` handler (75 files, one
missed is a hole); a shared refresh token between server and browsers
(rotation would revoke the others), so each cookieless browser gets its
own password sign-in.
