---
title: What is feega
description: The canvas, its nodes, and who works on it.
sidebar:
  order: 1
---

feega is an infinite canvas for motion video and images. Everything on it is a typed node. A person, the chat in the sidebar, or an outside agent over MCP can create and change nodes.

Node types (from the `nodes.data` schema): `text`, `image`, `video`, `doc`, `iframe`, `social_account_feed`, `social_post_mockup`, `products`, `ads`, `influencer`. Frames, the canvas unit for designs and videos, are nodes too.

## Hierarchy

```
org ──┬── brands            voice, palette, accounts: used to publish
      └── projects ──┬── canvases ── nodes ── nodes_connections
                     │                 └── node_runs (one generation)
                     └── assets
```

- A project needs no brand. You attach one only when material becomes something to publish.
- Everything on a canvas is saved in the background; teammates see edits live.

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
