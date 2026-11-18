# Local agent chat: one live session per chat, steps, stop, effort

The owner opened the local chat, asked Claude Code a question and watched "Agent · Working…"
forever. Diagnosis from Claude's own logs: every turn spawned a fresh `npx` ACP adapter; that run
waited 36 s for Feega's MCP server (`npx -y bun run cli/mcp/stdio.ts` hit Claude's 30 s connect
timeout) and called the model 46 s in. Nothing reached the tab meanwhile. Then the owner left the
page: the SSE stream closed, the agent kept sending `session/update`, `controller.enqueue` threw
inside the readline handler and the whole local server exited (`ERR_INVALID_STATE`).

What changed:

- `createAcpSessions` (`src/lib/server/acp/client.ts`) keeps one agent process and ACP session
  per chat `thread`, reused across turns, closed after 15 min idle or when the thread switches
  agent. Second turns answer in ~1-2 s and remember the first. `runAcpTurn` is gone.
- The route never enqueues after the client leaves: a `gone` signal guards `send`, the stream's
  `cancel()` aborts the turn, and the abort sends `session/cancel`. Non-JSON stdout lines from an
  agent are skipped instead of throwing.
- New `starting` event when a thread launches its agent; `{ cancel: thread }` stops a turn.
- `AcpChat` renders thoughts, `tool_call`/`tool_call_update` (status, title, input, output) and
  `plan` through the cloud `ChatMessage`/`ChatToolRow`, follows the latest line like the cloud
  panel, shows "Stopped" after a cancel and offers Retry on a failed turn.
- Effort: Claude Code exposes a `thought_level` config option, Codex `model[effort]` variants of
  its unstable models list. `models.ts` reads both into `efforts` per model and `switchesFor`
  plans the calls (config option, or one `session/set_model` with the variant). Saved per agent
  in the `.feega` manifest (`acpEfforts`). The effort select moved out of `ChatModelPicker` into
  `ChatEffortPicker`, shared by both chats. CLI: `feega agents models <agent> --effort <level>`.

Left out: attachments (both agents accept ACP image blocks, but local mode has no upload path to
hand them over yet), a thread list (threads are not persisted; reload starts a new one), copy and
regenerate (the cloud panel has neither). The desktop IPC path keeps one process per turn: it
has its own CJS client (`apps/desktop/acp-client.cjs`); stop works there through the same
`cancel` body. The agent's cwd is still the server's working directory.
