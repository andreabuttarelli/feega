# Agents quickstart

**Before:** connecting an agent meant reading `cli/docs/mcp.md`, `docs/mcp-tools.md` and the op
catalogue in the source, with no worked example.

**Now:** `docs/agents-quickstart.md` covers Claude Code, Cursor and Claude Desktop, the CLI, auth,
and five flows with exact tool calls (3-scene video from a URL, edit text and colours, images into
a frame, combine and export MP4/Lottie, share a link). Names and arguments checked against
`cli/mcp/tools`, `canvas-ops.ts` and `motion-tools.ts`.

**Found while writing it:** `cli/docs/mcp.md` says static API keys are unsupported, true for MCP and
the CLI, while the REST API accepts `feega_` keys. The guide states both.

**Not verified by running:** the calls were not executed against a live project.
