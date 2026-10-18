# New organisation from the sidebar

A user could only get an org at first sign-in (`createFirstOrg`) or by
invite; the switcher showed only with two or more.

Now the switcher is always visible with "New organisation" under it.
Path: form in `AppSidebar.svelte` -> `createWorkspace`
(`dashboard/api.ts`) -> `POST /api/v1/orgs` -> `createOrg`
(`team/orgs.ts`) -> `createFirstOrg` (service role, same registry entry:
the membership is being born, RLS cannot allow it) -> `orgs`,
`orgs_members` (owner), `credit_ledger` welcome grant, then
`setActiveOrg`. Existing rules unchanged: `assertFreeOrgLimit` refuses
past `FREE_ORGS_PER_USER`, answered as 402 with the billing path.

CLI `feega orgs create <name>`, MCP `team_op create_org`.
