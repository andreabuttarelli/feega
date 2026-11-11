# 0036 — ACP agents drive the local canvas

Status: proposed 2026-11-11.

## Context

Local mode (`feega local`, desktop app) hides the chat: the built-in agent needs an account and
credits. Users already run Claude Code, Codex or Gemini CLI. The Agent Client Protocol
(agentclientprotocol.com) lets an editor spawn any such agent and talk to it over JSON-RPC on
stdio: `initialize`, `session/new` (cwd, MCP servers), `session/prompt`, `session/update`
notifications, `session/request_permission` back to the client. Gui uses it to edit source.

## Decision

1. The local Feega server is the **ACP client**. It spawns the user's agent per turn and hands
   it Feega's own MCP server (`cli/mcp/stdio.ts`, pointed at the local app URL) in
   `session/new`. The agent edits the canvas through the same tools as any MCP agent: no new
   tool surface, so the direction app → CLI → MCP holds.
2. Agents are rows in one table, `ACP_AGENTS` (`src/lib/server/acp/agents.ts`): Claude Code
   and Codex via Zed's ACP adapters, Gemini CLI native. A new agent is a row.
3. The client advertises no `fs` or `terminal` capability: the agent reaches Feega only via MCP.
4. Permission requests are answered with the `allow_once` option. The user chose the agent;
   its own permission settings still apply to its built-in tools.
5. Local mode only: `POST /api/v1/local/acp` is 404 elsewhere. Cloud would need a sandboxed
   agent process per user; out of scope.
6. Tests stub the agent with `src/lib/server/acp/fake-agent.mjs`, a real ACP process. No model
   calls.

## Slice built

`runAcpTurn` (client), the agent table, the endpoint, tests. Not built: settings picker, the
chat panel reading `localOff(Chat)` as "on when an ACP agent is set", streaming updates to the
browser, keeping one session across turns, cancel (`session/cancel`). Each is a follow-up.

## Rejected

- Feega as an ACP **agent** (editors drive Feega): Feega is the surface, not the reasoner.
- A dependency on the ACP SDK: the client needs four methods; ~100 lines of JSON-RPC.
