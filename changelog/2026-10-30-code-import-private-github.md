# Import from code: private GitHub repositories through Composio

Spec `docs/specs/code-import.md`, section "Private repositories".

- Decision (user, 2026-10-30): no OAuth app of ours; Composio Platform holds the GitHub connection
  per user and org (`<orgId>:<userId>` as the owner). We store only the connected account id
  (`user_connected_accounts`, migration `20261030120000`, not applied: SQL in the PR).
- Port `AccountLinks` (`src/lib/server/connections/account-links.ts`): link, status, call,
  forget. Adapter `composio-links.ts` speaks REST v3.1 with `fetch`. Discarded the
  `@composio/core` SDK: it brings `openai`, `pusher-js`, bumps `undici` and hoists a
  `@types/json-schema` that turns `ai`'s `jsonSchema()` types red in `svelte-check`.
- Connect: `POST /api/v1/projects/:id/github/connect` → Connect Link; callback
  `GET /api/v1/github/callback` verifies the sealed state, the signed-in user and the pending
  account id before asking Composio the status (callback params are not proof).
- Import: an active connection asks GitHub (through the proxy) whether the repo is private; a
  private repo's tarball is fetched on our server (the proxy's `binary_data.url`, or GitHub's 302)
  and written into the sandbox, so no token or signed URL reaches the repo's code. Public repos
  still clone, connection or not.
- Dialog: Connect GitHub / Disconnect, repository and branch pickers. API, CLI
  (`feega canvas github <project> status|connect|repos|branches|disconnect`) and MCP ops
  (`github_*`) in parity.
- Not proven live: `COMPOSIO_API_KEY` was not set when this landed; every Composio call is
  covered by tests on a fake backend shaped after the v3.1 docs. The tarball through
  `binary_data` is the part to watch on the first real run.
