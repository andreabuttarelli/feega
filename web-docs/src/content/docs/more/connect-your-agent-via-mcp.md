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
claude mcp add feega -- npx -y feega mcp
```

Cursor, in `.cursor/mcp.json` of the project (or `~/.cursor/mcp.json` for every project):

```json
{
  "mcpServers": {
    "feega": {
      "command": "npx",
      "args": ["-y", "feega", "mcp"]
    }
  }
}
```

Codex, in `~/.codex/config.toml`:

```toml
[mcp_servers.feega]
command = "npx"
args = ["-y", "feega", "mcp"]
```

Start the agent from your project folder: Feega picks the editor that has that project open.

## Local tools

They need no sign-in. Open Feega in the project first, with `npx feega` or the VS Code panel.

| Tool | Returns |
|---|---|
| `feega_selection` | The selected element: source file and line, selector, component and view. The same text as **Copy for agent**. |
| `feega_screenshot` | A screenshot of the tab you are looking at, as an image. Pass `selection` to crop it to the selected element. |
| `feega_context` | The block the AI tab attaches: selection, page, preview width, breakpoint, theme, state and focused component. Answers even with nothing selected. |
| `feega_changes` | The visual edits made in this session: property, value, scope and the files each one touched. |
| `feega_editors` | The Feega editors running on this machine, with their project. |

`feega_selection`, `feega_screenshot`, `feega_context` and `feega_changes` take an optional `project` folder to ask another editor. With several editors on one project, the one used last answers. When none is running, the tool says to open Feega in the project first, and names the projects that have it open.

Feega listens on `127.0.0.1` only. Each editor writes its port and a random token to `~/.feega/editors`, readable by your user only, and requests without the token are refused.

## Cloud tools

`feega_share`, `feega_snapshot`, `feega_comments`, `feega_review`, `feega_resolve` and `feega_stop` share the running editor as a live link, read the comments left on it and read the review. They need a Feega Cloud plan. Signed out, they say to run `npx feega` and sign in, or to set `FEEGA_API_KEY`. Without a plan, they point to the billing page.

## Review rounds

A shared session is reviewed in rounds. In the Comments tab, write what changed and choose Publish new round: the round records the edits listed in the Changes tab. Each round starts awaiting review.

Reviewers open the session link after it ends. For each round they choose Approve or Request changes, with an optional note. The status of the session follows its latest round: changes requested if any reviewer asked for changes, approved if at least one approved and none asked, awaiting review otherwise. The host cannot decide on their own round.

The Comments tab shows the status of the latest round and who decided. `feega_review` gives your agent the same: the status, the round, each verdict with its note and the comments still unresolved, so it can act on the feedback and then call `feega_resolve`. Review rounds need a Feega Cloud plan.
