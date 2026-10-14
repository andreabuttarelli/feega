# One chat drives the canvas and its frames

Context: the user talked to two AIs. The canvas chat (`project-agent/`) handed frame work to the
motion agent (`motion-delegation.ts`), and the frame editor had its own chat (`motion/turn.ts`)
with its own thread per frame. External agents already had one surface: MCP `motion_tool`, which
runs any editor tool through `runMotionTool` (`motion/tool-run.ts`).

Decision:

- **One thread.** The editor's Chat tab posts to the canvas chat (`/api/v1/projects/:id/agent`)
  and reads its thread: the `sidebar` thread, one per project and user. Per project, not per
  canvas: that is what the sidebar already used, and splitting it would hide existing history.
  The sidebar and the editor share the same client session, so a turn shows in both.
- **Frame tools by name, not by schema.** The canvas chat gets three tools: `list_frame_tools`,
  `describe_frame_tool`, `frame_tool {node_id?, tool, input}`. `frame_tool` calls `runMotionTool`
  — the MCP runner — so validation, moderation, revisions and the tool set are the same code.
  Measured (name + description + JSON schema): the 150 editor tools are 136,557 chars (~34k
  tokens); the three frame tools are 1,151 chars. Loading the full set when a frame is open was
  discarded: it would multiply every turn's prompt by ~8 for edits that touch one or two tools.
  `tool-budget.test.ts` holds both numbers.
- **Context.** The editor sends `frame {nodeId, selection, playhead, mode}`; the prompt names it
  and `frame_tool` defaults to it. Calls in one turn share one editor session per frame, so
  `describe_frames` reads what `view_frames` saw.
- **Frames come from the open editor.** `view_frames` writes `data-motion-frames` into the chat
  stream; the editor draws and uploads to the frame's existing `/frames` endpoint; the server
  waits on storage, then falls back to the server browser. With neither, the tool is refused as
  `needs_open_editor` before it runs.
- **The motion agent stays, as an engine.** Building or rebuilding a whole video still goes
  through `ask_motion_agent` / `create_motion_video`, which run the director, roles, gates and
  critic. Its run writes to the frame's old thread; the user reads the result in the canvas chat.
- **Old frame threads stay readable**, read-only, as a collapsed "Earlier chat about this frame"
  above the editor chat (`GET .../motion/:node/agent`, unchanged).

Consequences:

- The motion endpoint `POST .../motion/:node/agent` has no UI caller any more. It is kept because
  `eval:motion` and `social-refs-check` drive it, and drafts #480/#487 change `turn.ts` behind it.
  When those land, it is removed with ChatPanel's `motionNodeId` path (script brief, cut review
  and budget cards), which only that endpoint fed.
- A delegated motion run outlives the canvas turn; the editor learns of its revision on the next
  turn end or reload, not live.
- `frame_tool` does not run the motion agent's self-check: a precise edit is checked only if the
  chat calls `view_frames`. Whole-video work keeps the gate through delegation.
