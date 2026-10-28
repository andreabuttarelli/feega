# Connect button and `npx feega mcp`

The canvas top bar gets **Connect** next to the project switcher: a popover with per-client MCP setup
and copy buttons. Snippets come from `src/lib/canvas/agent-connect.ts`; the mode comes from
`isLocalMode` (`PUBLIC_FEEGA_LOCAL`), the same source as the LocalOff table.

- Cloud: remote `https://mcp.feega.app/mcp` for Claude Code, Claude (custom connector), Codex
  (`url` + `codex mcp login`), Cursor. ChatGPT and Claude mobile left out: their flows were not
  verified against our server.
- Local: before, the only local path was `bun run <clone>/cli/mcp/stdio.ts`, and the docs implied
  agents found port 5173 by themselves, while `npx feega` binds a random port. Now
  `npx feega mcp [--port n]` runs the stdio server bundled into the app release
  (`scripts/app-bundle.sh` → `mcp.mjs`, esbuild, `open` external since local mode skips browser
  login) with `PUBLIC_APP_URL=http://127.0.0.1:<port>`. The popover fills in the real port from
  `location.origin`.
- Launcher install logs and `tar`/`npm ci` output moved to stderr: stdout is the MCP channel.
- An app version without `mcp.mjs` (up to 0.1.4) fails with a hint to update.
