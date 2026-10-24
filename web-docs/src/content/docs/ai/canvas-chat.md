---
title: Canvas chat agent
description: One chat that drives the canvas and its frames.
sidebar:
  order: 1
---

The chat in the sidebar is one agent for the whole project. It edits nodes and, through frame tools, what is inside a frame. The editor's Chat tab posts to the same thread, so a turn shows in both ([ADR 0013](/architecture/adr/0013-one-chat-drives-canvas-and-frames/)).

- **One thread per project and user.**
- **It sees what you select.** The editor sends the selected frame, selection, playhead and mode; the agent can look at and check the selected frame.
- **Frame tools by name.** The agent lists and describes frame tools on demand rather than loading all of them, then calls them through the same runner MCP uses.
- **Comments.** `@feega` in a canvas comment starts the agent on the pinned node.
- **Spending.** Generation and some ops use credits. Self-hosted instances have no credit limits ([Self-hosting](/self-hosting/)).

Outside agents get the same surface through [MCP](/integrations/mcp/): the [`edit` ops](/reference/generated/edit-ops/) and `view`.
