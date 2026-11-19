# The web app is reduced to sign-in, account and a dashboard

Decision: the hosted app is empty until Feega Cloud exists; Feega lives in the editor.

Before: signed-in shell with sidebar, project/canvas lists, team switcher, credits, settings
sections.

Now:
- Shell is the Feega mark, an account menu (name, email, Account, Sign out) and the page.
- `/app` shows the greeting, the Cloud line, and links to the extension and GitHub.
- `src/routes/app/+layout.server.ts` redirects any app route not in `src/lib/app-routes.ts`
  to `/app`. Reachable: `/app`, `/app/settings/profile`.
- Auth, `/cli/callback`, `/p/*`, and `/api/v1` are untouched; routes, data and endpoints are
  not deleted, only unreachable from the app shell.

Discarded: deleting the routes (the extension and CLI still call the API).
