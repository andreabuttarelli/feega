---
title: What is feega
description: The canvas, its nodes, and who works on it.
sidebar:
  order: 1
---

feega is an infinite canvas for motion video and images. Everything on it is a typed node. A person, the chat in the sidebar, or an outside agent over MCP can create and change nodes.

Node types include `text`, `image`, `video`, `doc` and `iframe` for material and generation; frames (designs and videos) and free elements (shapes, text, vectors placed outside a frame) are nodes too. `describe_node_types` over MCP returns the exact schema per type.

## Hierarchy

```
org ── projects ──┬── canvases ── nodes ── nodes_connections
                  │                 └── node_runs (one generation)
                  └── assets
```

- An org holds members, projects and settings such as the [model allow-list](/ai/model-allow-list/) and [spend limits](/ai/spend-limits/).
- Everything on a canvas is saved in the background; teammates see edits live.
- A canvas can be saved as a [named version](/canvas/versions/) and restored later.

## Ways to work

| You | Tool |
|---|---|
| Draw, animate, export | The canvas editor |
| Ask for changes in words | [Canvas chat](/ai/canvas-chat/) |
| Script or automate | [CLI](/integrations/cli/) |
| Let Claude Code, Cursor or Claude Desktop drive | [MCP](/integrations/mcp/) |

:::note[How these docs were checked]
Guides are written from the code and the public changelog on `dev`. Button labels come from the changelog; if the app differs, the app wins. Anything not confirmed in code is marked **Unverified**.
:::
