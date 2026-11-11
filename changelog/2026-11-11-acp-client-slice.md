# ACP client slice for local mode

ADR 0036. Local mode had no chat; ACP lets the user's own agent (Claude Code, Codex, Gemini
CLI) drive the canvas through Feega's MCP tools. This lands the server half: `runAcpTurn`,
the `ACP_AGENTS` table and `POST /api/v1/local/acp`, tested against a fake ACP agent process.
No UI yet, so no public changelog entry: settings picker and chat wiring follow.
