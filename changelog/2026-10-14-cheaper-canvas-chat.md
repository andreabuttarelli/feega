# Canvas chat: prompt cache, edit routing, tool names in the prompt

Measured on production (ai_calls, 3 turns: create poster from template, change
headline, export PNG): $1.65 + $1.08 + $0.57 = $3.29, `cached_tokens` 0 on every
call. History was not the cause (it is text only); each turn re-sent ~35k tokens
of system + tools per step, for 4–10 steps, uncached, on Opus.

- The project agent now sends Anthropic `cache_control` (`PromptCache.On`), like
  the motion agent already did (~90% hit share there).
- `turnModel` (project-agent/model-route.ts): one table routes a short edit
  request (change/set/export/rename…) to Sonnet only when the turn names no
  model. The panel now sends a model only if the user picked one (saved or
  chosen; `GET /api/v1/chat-models` returns `picked`), so a user who picks
  Opus keeps Opus. Creative/open requests keep the default (Opus).
- `frame_tool`'s description names every editor tool, so turns stop opening with
  `list_frame_tools` (28 KB of output, read again at every later step).

After (same script, local server against production): $0.28 + $0.09 + $0.02 =
$0.39, cache hits 75–99%. Headline landed; export_image was called correctly
(the PNG itself failed on the local Chromium, not a model issue).

Discarded: history compaction (history carries no tool results already), a
step cap (the existing one was never hit), loosening the describe_frames gate
(it only fires after the agent chose to view frames).
