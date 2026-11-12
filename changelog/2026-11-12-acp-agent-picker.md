# Local chat runs your own agent (ACP)

Follow-up to ADR 0036 / PR #1995, which built `runAcpTurn` and `POST /api/v1/local/acp` with
auto-allowed permissions and no UI.

- **Spec check** against agentclientprotocol.com: method names (`initialize`, `session/new`,
  `session/prompt`, `session/update`, `session/request_permission`, `session/cancel`) and
  payload shapes matched. One mismatch: a stdio `McpServer.command` must be an absolute path;
  we sent `npx`. Now `npx` beside the running Node.
- **Second mismatch, found in the real run**: the client answered unknown agent
  *notifications* with an error without `id`; JSON-RPC forbids replying to notifications and
  `claude-agent-acp` logged `Invalid message`. Now ignored.
- **Adapters renamed**: `@zed-industries/claude-code-acp` and `codex-acp` are deprecated in
  favour of `@agentclientprotocol/claude-agent-acp` and `@agentclientprotocol/codex-acp`.
- **Picker** in the Chat tab, local mode only (settings are hidden in local mode). Stored in
  `localStorage` (`feega.acpAgent`): one local user, nothing server-side to persist.
- **Streaming**: the endpoint answers with SSE (`$lib/acp/acp-events`), one event per
  `session/update`, a `permission` event, then `done` or `failed`.
- **Permissions** are no longer auto-allowed. Each request becomes a `permission` event; the
  turn waits in `$lib/server/acp/permissions` until the browser posts
  `{ permission: { id, optionId } }`. The choice shows instantly and rolls back with a notice if
  the post fails.
- **Cancel**: closing the request sends `session/cancel` and answers pending permissions
  `cancelled`, as the spec requires.

Discarded: reusing the cloud chat panel (AI SDK stream format, credits, threads) and a DB row
for the agent choice.
