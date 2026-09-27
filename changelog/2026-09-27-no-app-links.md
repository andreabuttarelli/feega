# Nothing links to /app

`/app` is a legacy 308 for old bookmarks. Fallbacks still pointed at it: login,
auth callback/reset/confirm, oauth/authorize, cli/callback, +error, docs, the
api-keys back link, `APP_BOOTSTRAP_PATH` in brand-slug, the unused `workspaces.href`
in the project layout, and `upgradeUrl` (no caller) on the billing contract.

Post-auth routes now use `landingPath` (see accept-invites). Client links and
server fallbacks without a user in hand use `HOME_PATH = '/'` (`src/lib/home-path.ts`):
the root hook resolves the signed-in user's home with `homePathFor`, else `/login`.
`upgradeUrl` is deleted from contract, both providers and tests.

`src/no-app-links.test.ts` fails if any non-test source contains a `'/app'`/`"/app"`
literal; hooks and the root layout are allow-listed because they match paths, and
agent-team-public because it scans external sites.
