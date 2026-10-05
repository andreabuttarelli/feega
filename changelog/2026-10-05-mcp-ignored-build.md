# The MCP project builds only when `cli/` changes

The second Vercel project (feega-5ksn, root `cli/mcp`, serves mcp.feega.app) rebuilt on every merge to main, about 39% of Build CPU minutes, though it only ships the MCP server. `ignoreCommand` in `cli/mcp/vercel.json` now skips the build unless something under `cli/` changed in the pushed commit.

Kept in the repo rather than in the project settings so the rule is versioned and reviewable.
