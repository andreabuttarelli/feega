# Every third-party account through Composio

Rule from the user: an integration is a Composio Connect Link plus Composio proxy calls. Feega
stores no OAuth client secret and no user token.

Before: GitHub went through Composio but push fell back to `GITHUB_PUSH_TOKEN`/`GITHUB_API_URL` and
code sync read with a server `GITHUB_TOKEN`; Figma used a pasted personal access token sealed in
`user_figma_tokens`; Drive and Dropbox ran our own OAuth (`GOOGLE_DRIVE_*`, `DROPBOX_*`) with sealed
tokens in `user_cloud_tokens`.

Now:
- `connections/account-access.ts` is the one connect/confirm/status/disconnect/call flow for every
  `Toolkit` (`github`, `figma`, `googledrive`, `dropbox`, `one_drive`). Per-toolkit differences
  (label, identity call, handle) are one row in `connections/toolkits.ts`. `githubAccess` builds on it.
- One callback, `/api/v1/connections/callback` (was `/api/v1/github/callback`); it lands back with
  `?<toolkit>=connected|failed`.
- The proxy port gained `headers`, `binary` (Composio `binary_body`, base64) and `DELETE`.
- Figma REST (`import-file`, `import-images`, `import-frames`) takes a `ProviderCaller` instead of
  token + fetch. `/figma-token` became `/figma-connection`; MCP `figma_token_status` became
  `figma_status`; CLI `figma-token` became `figma-status`.
- Cloud: `cloud.ts` keeps one row per provider (toolkit, list, download, upload), all through the
  proxy; downloads read `binary_data.url`. OneDrive added (Microsoft Graph). Connect is
  `POST /projects/{id}/cloud/{provider}/connect` answering `{ url }`.
- Settings, Profile: the Figma token panel and the Drive/Dropbox panel became one Connections list
  (`connectAccount`, `disconnectAccount`).
- No Composio key: every connection answers `not_configured`. No connected GitHub: push answers
  `not_connected`. Local mode pushes a folder with the git CLI and opens no pull request.

Deleted: `cloud/access.ts`, `cloud/disconnect.ts`, `cloud/token-store.ts`, `figma/token-store.ts`,
`settings/figma-actions.ts`, `settings/cloud-actions.ts`, `/api/v1/cloud/*`, `tokenCall` (both),
env `GITHUB_PUSH_TOKEN`, `GITHUB_API_URL`, `GITHUB_TOKEN`, `GOOGLE_DRIVE_CLIENT_ID/SECRET`,
`DROPBOX_CLIENT_ID/SECRET`. Revoking at the provider is gone with the tokens: disconnect deletes the
Composio connected account.

Tables `user_figma_tokens` and `user_cloud_tokens` stay (migrations are immutable), marked
DEPRECATED by `20261119120000_deprecate_own_token_tables.sql`. Their rows still hold sealed tokens
until someone empties them.

Discarded: keeping the token paths as a fallback when Composio is missing (two paths for one job);
GitHub Enterprise via `GITHUB_API_URL` goes with it.
