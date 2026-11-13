---
title: Cursor and VS Code
description: Open .feega canvases inside Cursor, VS Code and other VS Code editors, with the local MCP server registered for your agent.
sidebar:
  order: 2
---

The Feega extension opens `.feega` files as a canvas in an editor tab. It runs
[local mode](/getting-started/local-mode/) for that file, so there is no account, and saves to the
file as you work.

Install it from the VS Code Marketplace or Open VSX (Cursor, Windsurf, VSCodium) once it is
listed there: search **Feega**. It needs Node 22 or later on your machine.

- **Open a `.feega` file**: it opens as a canvas. The first time, the app downloads once.
- **Feega: New canvas** (command palette): picks where to save a new `.feega` file and opens it.
- **Feega: Import this folder into a canvas**: creates `<folder>.feega` in the workspace and draws
  the project's pages on it, as `npx feega --import` does: every static page the router finds, up
  to 20. Pages that need a value (`/blog/[slug]`) are skipped and listed in the **Feega** output.
  A project with no router found imports its home page only. In a monorepo a quick-pick asks which
  app to import. While it runs, the tab lists each step: download the app, start Feega, find
  pages, install the project's dependencies (when `node_modules` is missing, with the manager its
  lockfile names), start its dev server, import page N of M. A failing step turns red with the
  reason and the end of the dev server's log, and **Retry** starts over. When it finishes the canvas
  replaces the list, and a notification says how many pages landed and where the canvas
  file is. The file lives inside the folder, so the extension offers once to add `*.feega` to
  `.gitignore`; it never writes it without asking.

## Your agent

While a canvas is open, the extension registers its local MCP server, named `feega <file>`:
in VS Code through the MCP server list, in Cursor through Cursor's MCP settings. The agent in the
chat edits the canvas you are looking at, and you see its changes live. Close the tab and the
server goes away.

Other agents, such as Claude Code in a terminal, connect with `npx -y feega mcp --port <port>`;
the port is in the **Feega** output panel. See [MCP setup](/integrations/mcp/#local-mcp).
