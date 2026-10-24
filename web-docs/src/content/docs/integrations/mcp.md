---
title: MCP setup
description: Connect Claude Code, Cursor or Claude Desktop to feega.
sidebar:
  order: 1
---

feega's MCP server lets an agent read and write your canvases with the same sign-in as the CLI. There are no static API tokens.

- Remote: `https://mcp.feega.app/mcp`, Streamable HTTP. The host must send `Authorization: Bearer <access token>`; discovery is at `/.well-known/oauth-protected-resource`. A missing Bearer is a `401`, not a broken server. Health: `https://mcp.feega.app/health`.
- Local stdio: `feega-mcp` (`cli/mcp/stdio.ts`), sharing the session file `~/.config/feega/session.json`.

## Claude Code

```bash
claude mcp add --transport http feega https://mcp.feega.app/mcp
```

**Unverified:** the OAuth round in Claude Code against feega's authorization server was not run for these docs. If it fails, use the local option below.

## Local stdio (Cursor, Claude Desktop, any client)

Sign in once with `feega login`, then add:

```json
{
  "mcpServers": {
    "feega": {
      "command": "bun",
      "args": ["run", "/ABS/PATH/to/feega/cli/mcp/stdio.ts"]
    }
  }
}
```

Needs [Bun](https://bun.sh) and a clone of the repo (or the CLI binary). Then call `query` on `projects` to confirm you are signed in.

## Cursor with the remote URL

```json
{ "mcpServers": { "feega": { "url": "https://mcp.feega.app/mcp" } } }
```

Some Cursor builds register a `cursor://` OAuth callback that feega's registration endpoint refuses (it accepts only `https` or loopback `http`). Prefer local stdio, update Cursor, or bridge with [mcp-remote](https://www.npmjs.com/package/mcp-remote).

## First calls

1. `query` on `projects` or `brands`.
2. `view` with op `describe`, and `edit` with op `describe`, to see what you can do.
3. `list_motion_videos` to find a frame's node id.

The whole surface: [MCP tools](/reference/generated/mcp-tools/) and [Edit ops](/reference/generated/edit-ops/). Never guess an org, brand or project id: read it with `query` first.

:::caution
Source of this page: `cli/docs/mcp.md`. That file says "12 tools total" and refers to a `feega-cli` path; both are stale. `docs/agents-quickstart.md` does not exist on `dev`.
:::
