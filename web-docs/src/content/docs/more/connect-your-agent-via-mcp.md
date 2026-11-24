---
title: Connect your agent via MCP
description: Run npx feega mcp so Claude Code, Cursor or Codex can read the element you selected in Feega and the changes you made.
sidebar:
  order: 7
---

`npx feega mcp` serves Feega to your coding agent over MCP on stdio. The agent can ask for the element you selected, by file and line, instead of working from a description.

## Add it to your agent

Claude Code:

```bash
claude mcp add feega -- npx feega mcp
```

Cursor, in `.cursor/mcp.json` of the project (or `~/.cursor/mcp.json` for every project):

```json
{
  "mcpServers": {
    "feega": {
      "command": "npx",
      "args": ["feega", "mcp"]
    }
  }
}
```

Codex, in `~/.codex/config.toml`:

```toml
[mcp_servers.feega]
command = "npx"
args = ["feega", "mcp"]
```

Start the agent from your project folder: Feega picks the editor that has that project open.

## Local tools

They need no sign-in. Open Feega in the project first, with `npx feega` or the VS Code panel.

| Tool | Returns |
|---|---|
| `feega_selection` | The selected element: source file and line, selector, component and view. The same text as **Copy for agent**. |
| `feega_changes` | The visual edits made in this session: property, value, scope and the files each one touched. |
| `feega_editors` | The Feega editors running on this machine, with their project. |

`feega_selection` and `feega_changes` take an optional `project` folder to ask another editor. With several editors on one project, the one used last answers. When none is running, the tool says to open Feega in the project first, and names the projects that have it open.

Feega listens on `127.0.0.1` only. Each editor writes its port and a random token to `~/.feega/editors`, readable by your user only, and requests without the token are refused.

## Cloud tools

`feega_share`, `feega_snapshot`, `feega_comments`, `feega_resolve` and `feega_stop` share the running editor as a live link and read the comments left on it. They need a Feega Cloud plan. Signed out, they say to run `npx feega` and sign in, or to set `FEEGA_API_KEY`. Without a plan, they point to the billing page.
