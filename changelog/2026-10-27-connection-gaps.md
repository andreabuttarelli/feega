# Connections: disconnect, honest errors, paging, parity

Drive and Dropbox could be connected but not disconnected, Figma image fills failed without a word, and the CLI and MCP knew nothing of either.

- **Disconnect.** `DELETE /api/v1/projects/{id}/cloud/{provider}` removes the stored tokens (`cloudTokenStore.remove`) and revokes them at the provider: Google revokes the refresh token, Dropbox the access token. A refused revoke does not block forgetting the tokens; the response says `revoked: false`. Buttons in the picker and in Settings, Profile.
- **One error registry** (`connection-messages.ts`): server error code to sentence, shared by Figma image fills (token refused, rate limit, Figma down, shown in the canvas banner) and the cloud picker (`download_failed`, `not_connected`, generic "Export failed"). The export route's reason is no longer thrown away by the page.
- **Figma Test** called `/v1/me`, which needs Current user. A 403 whose message names a scope now passes with a note; an invalid or expired token still fails. The alternative, a file call, needs a file key the settings page does not have.
- **Drive root export** sent `parents: ['']`; it sends `root`.
- **Export name** is the storage path minus its generated id prefix. Assets carry no name column, so there is no stored display name to use.
- **Paging.** Drive `pageToken` and Dropbox `list_folder/continue`, surfaced as `next` and "Load more". Native Docs, Sheets and Slides export to PDF and Drawings to PNG on import; other native types are listed as not importable.
- **Parity.** `feega cloud ...`, `feega figma-token`, MCP `cloud` and `figma_token_status`, `CLOUD_ACTIONS` and `FIGMA_TOKEN` in the parity registry. Saving, testing and removing the Figma token stay app-only on purpose: agents never hold a secret.
