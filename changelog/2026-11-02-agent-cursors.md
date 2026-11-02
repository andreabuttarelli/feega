# Agent cursors on the canvas

Agents (chat, its sub-agents, MCP) now show up as live collaborators: cursor, selection outline,
avatar in the top bar.

- **Transport.** No new channel, no table. The server sends a `canvas-peer` broadcast on the
  private `canvas:<id>` channel, the same one human cursors use, via Realtime REST
  (`httpSend`) with the service role key (registered in `service-role-uses.ts`). Before, an
  MCP agent with an API key had no JWT to join that channel.
- **One hook per execution layer.** `runOp` (`server/canvas/canvas-ops.ts`) wraps every canvas op,
  used by both the chat tools (`project-tools.ts`) and MCP `edit` (`edit/runners.ts`).
  `runMotionTool` / `runMotionBatch` (`motion/tool-run.ts`) cover frame tools for both. Both call
  `showAgentAt`, which runs in background (`runInBackground`): no latency added to the tool.
- **Position.** Node ids come from the op input and answer (`touchedNodes`), boxes from one lean
  read (`nodeBoxes`: id, canvas, x, y, width, height). The cursor sits inside the union box at an
  offset hashed from the agent id, so parallel agents on one frame don't overlap. Node level only:
  clip boxes inside a frame are not resolved.
- **Identity.** `agent:<agentKey>:<sessionId>[:<lane>]`, used as both `sessionId` and `userId` of
  the mark, so `get_selection` (which keeps the caller's own marks) never mistakes an agent for
  the user. Sub-agents get a lane through `AsyncLocalStorage` (`agents/agent-lane.ts`) set in
  `spawnAgents`, so the tools they share with the parent publish under `Claude · subagent N`.
- **Throttle.** Per agent, at most one send every 150 ms: leading send plus a trailing one with the
  latest work.
- **Client.** `CanvasMark.agent = { doing }` (nullable, defaults to null for humans). Agent marks go
  stale after `AGENT_IDLE_MS` (6 s) instead of 10 s. Agent cursors glide with an eased 700 ms
  track (`peer-tracks.ts`) instead of the jitter-buffer playout, which snaps jumps over 400 px.
  `AgentAvatars.svelte` draws a hashed shape/colour/initial with a sparkle badge; hover title
  says what the agent is doing.

Left alone: `org-data/presence.ts` (`agent:active` on a public channel nobody listens to) still
runs for the raw `write` tool.

Guards: `agent-presence.test.ts`, `agent-cursor.test.ts`, `canvas-ops.presence.test.ts`,
`peer-tracks.test.ts`, `canvas-presence.test.ts`, `agent-avatars-render.test.ts`. Browser:
`scripts/demo-record/demos/agent-cursors.demo.ts` drives three MCP sessions on `/api/v1/edit`.
