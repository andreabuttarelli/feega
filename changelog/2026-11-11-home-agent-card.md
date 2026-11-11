# Connect-your-agent card on the home

`/app` now says how to drive the canvas from outside.
`AgentCard.svelte` shows, per client (Claude Code, Codex, Cursor), the remote MCP command with a copy
button, plus a link to docs.feega.app/integrations/mcp.

Commands come from `agent-connect.ts` (`homeAgentClients`), the same source as the canvas Connect
popover, so the two cannot drift.
The CLI is left out: it is not public. Plugins and local-mode MCP left out: the card is the cloud path.
