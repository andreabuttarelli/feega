# The active organisation is stored on the profile

Before, "which org" had two answers: the `dz-org` cookie in the browser,
and for the CLI/MCP (JWT) the user's *oldest owned* org
(`ensureOrgForUser`) or `orgIds[0]` (`org-data/auth.ts`). Switching in
the sidebar did not reach the CLI, and with no cookie the fallback was
whatever row Postgres returned first.

Now `profiles.active_org_id` (migration `20261017120000_active_org.sql`)
is the per-user choice. `listMemberships` returns the active org first,
then by membership age, so every existing `chooseOrg(memberships, cookie)`
and `memberships[0]` falls back to it with no per-site change. The cookie
stays as the per-tab hint the switcher sets alongside.

Switching: sidebar select -> `chooseWorkspace` (`dashboard/api.ts`) ->
`PUT /api/v1/orgs/active` -> `switchOrg` (`team/orgs.ts`) ->
`setActiveOrg` -> `profiles.active_org_id`. CLI `feega orgs [use <id>]`,
MCP `list_orgs` / `team_op switch_org`.

Discarded: replacing the cookie outright (bearer `?org=` and the
dashboard cache key on it); a new helper at every call site (the
ordering in one query covers them all).
