---
title: Feega Cloud for agents (coming soon)
description: Register the Feega MCP server in Claude Code, Cursor or Codex so your agent can share a session, read comments and resolve them.
sidebar:
  order: 7
---

Coming soon. Feega Cloud needs a paid plan.

`npx feega mcp` serves Feega Cloud to your coding agent over MCP. It makes no model calls.

## Sign in

Run `npx feega` once and sign in, or set `FEEGA_API_KEY` to a `feega_` key.

## Register it

Claude Code:

```bash
claude mcp add feega -- npx feega mcp
```

Cursor, in `.cursor/mcp.json`:

```json
{ "mcpServers": { "feega": { "command": "npx", "args": ["feega", "mcp"] } } }
```

Codex, in `~/.codex/config.toml`:

```toml
[mcp_servers.feega]
command = "npx"
args = ["feega", "mcp"]
```

## Tools

| Tool | What it does |
|---|---|
| `feega_share` | Shares the project as a live link. Starts the editor if none runs. |
| `feega_snapshot` | Saves a named snapshot of a session. |
| `feega_comments` | Lists comments with file, line, column, selector, author and text. |
| `feega_resolve` | Resolves a comment, with an optional note. |
| `feega_stop` | Stops the session. |

Without a paid plan, the tools tell you to upgrade.
