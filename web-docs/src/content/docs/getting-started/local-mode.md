---
title: Local mode
description: One canvas on your machine, saved in a .feega file. No account, no database, no Docker.
sidebar:
  order: 4
---

Local mode runs feega on your computer for one canvas. Everything you draw is saved in a single
`.feega` file, the same file feega.app imports.

```sh
git clone https://github.com/andreabuttarelli/feega && cd feega && npm install
npm run local -- my-canvas.feega
```

Open http://localhost:5173. The first run builds the app, which takes a few minutes. If the file
does not exist it is created; every change is written back to it within a second, and again when
you stop the server with Ctrl-C.

## With an agent

The [CLI](/integrations/cli/) and the [MCP server](/integrations/mcp/) find the local server on
port 5173 and need no `feega login`. What an agent adds or changes appears live in your browser.
`canvas_file` with `action: "save"` writes a copy of the file wherever you ask.

## What needs the cloud

Sharing, comments, saved versions, voices and AI generation answer with a message instead of
running. Import the file at feega.app to use them: canvas menu or home page, **Import .feega**.

To open a different file, stop the server and start it again with that file.

## Safety

There is no login, so the server listens on 127.0.0.1 only and refuses to start on any other
address.
