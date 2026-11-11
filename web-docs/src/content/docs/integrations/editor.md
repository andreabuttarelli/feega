---
title: Cursor and VS Code
description: Open .feega canvases inside Cursor, VS Code and other VS Code editors, with the local MCP server registered for your agent.
sidebar:
  order: 2
---

The Feega extension opens `.feega` files as a canvas in an editor tab. It runs
[local mode](/getting-started/local-mode/) for that file, so there is no account, and saves to the
file as you work.

Install it from the VS Code Marketplace or Open VSX (Cursor, Windsurf, VSCodium): search **Feega**.
It needs Node 22 or later on your machine.

- **Open a `.feega` file**: it opens as a canvas. The first time, the app downloads once.
- **Feega: New canvas** (command palette): picks where to save a new `.feega` file and opens it.
- **Feega: Import this folder into a canvas**: creates `<folder>.feega` in the workspace and draws
  the project's home page on it, as `npx feega --import` does.

## Your agent

While a canvas is open, the extension registers its local MCP server, named `feega <file>`:
in VS Code through the MCP server list, in Cursor through Cursor's MCP settings. The agent in the
chat edits the canvas you are looking at, and you see its changes live. Close the tab and the
server goes away.

Other agents, such as Claude Code in a terminal, connect with `npx -y feega mcp --port <port>`;
the port is in the **Feega** output panel. See [MCP setup](/integrations/mcp/#local-mcp).
