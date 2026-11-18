# Local coding agents on cloud canvases in the desktop app

Local agents (Claude Code, Codex, Gemini, opencode, ...) only worked on a `.feega` file, over the
local server's HTTP routes. On a cloud canvas in the Electron app there was no way to reach them.

The desktop preload now exposes `feegaLocalAgents` (list, choose, start, answer, cancel, onEvent),
served by `apps/desktop/local-agents.cjs`: detection (`acp-agents.cjs`) and the ACP turn
(`acp-client.cjs`) run in the main process, and the agent is handed the Feega MCP server with the
user's session token so it edits the cloud canvas through the same tools as any external agent.
Every channel validates its input and refuses pages outside the hosted origin.

`src/lib/acp/agent-transport.ts` maps the surface to a transport (file: HTTP, desktop cloud: IPC,
browser: none) and adapts IPC to the same `fetch` port `AcpChat` and `AgentChoices` already use, so
`AcpChatPanel` is reused unchanged. The right bar shows a Feega / Local agents switch on desktop.

Also: the native canvas bridge is only exposed when the addon is loaded (`native-canvas:available`),
since the preload is now always attached.

Not in this slice: per-agent model choice over IPC.
