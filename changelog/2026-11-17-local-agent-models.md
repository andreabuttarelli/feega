# Local agents: model picker read live over ACP

**Why.** After picking an ACP agent the user could not change its model; each tool ran on its own
default.

**What.** `listAcpModels` opens a throwaway session (`initialize` + `session/new`) and reads the
models. Two shapes exist in the wild, handled in `src/lib/server/acp/models.ts`:

- `configOptions` entry with `category: "model"`, switched with `session/set_config_option`
  (claude-agent-acp, codex-acp, opencode);
- unstable `models.availableModels` / `currentModelId`, switched with `session/set_model`
  (gemini `--acp`; codex also sends it, the config option wins).

No shape → no picker. Answers are cached per agent (`model-cache.ts`), `?refresh=1` asks again,
a failed listing (cursor-agent without login: `Authentication required`) is not cached and comes
back as 502.

The choice is stored per agent in the manifest (`acpModels`, next to `acpAgent`). Each turn spawns
a fresh agent process, so the switch is sent after `session/new` on every turn; a saved model the
agent stopped offering is skipped, not forced.

**Discarded.** Hardcoded model lists, and CLI scraping (`opencode models`): ACP already returns
the real list for every agent installed here. No MCP tool: the MCP server is what the agent itself
uses; picking its own model from inside a turn makes no sense.

**Verified live (2026-11-17).** Claude Code 14 models, Codex 4, Gemini 8, OpenCode ~450 (all
configured providers), Cursor needs login. One Claude turn after `--set haiku` answered "Haiku 5.5".
