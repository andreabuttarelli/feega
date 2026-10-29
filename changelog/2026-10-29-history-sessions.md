# History 2: session ids on events (#1548)

Spec `docs/specs/history-panel.md`, ADR 0024.

- Migration `20261029150000_history_sessions.sql`: `session_id uuid` on
  `canvas_events` and `motion_revisions`; `commit_motion_revision` gets a
  10-argument overload with `p_session_id` and no longer coalesces two
  sessions into one revision. The 9-argument one stays until every deploy
  calls the new one.
- `Actor.sessionId` carries the session to every write; only
  `canvas_events` and `motion_revisions` store it (`actorCols` untouched, the
  other tables have no column).
- Who sets it: the CLI/MCP client sends `x-feega-session` (one UUID per CLI
  process or stdio MCP connection, derived from `mcp-session-id` on the
  hosted MCP, none when the host declares no connection: a serverless
  instance is shared, and one UUID per instance would merge strangers);
  `/api/v1/edit` puts it on the caller. The sidebar chat and the motion
  agent open one per turn.
- People get no id: `historyGraph` groups rows without one by a 10 minute
  idle gap on their lane (`IDLE_SESSION_MS`). Same rule covers rows written
  before the migration.
- Rows now name what they touched (`subject`): node display name, else its
  type label (`NODE_KIND_LABEL`); edges as `source → target`. One registry,
  `SUBJECT_OF`, one row per event kind.
- Panel: one row per session, expandable to its steps. API/MCP add
  `sessions`, `subject`, `session_id`; CLI table adds `session`.
- Known gap, not fixed here: MCP canvas ops build their actor with the
  sidebar agent key (`canvasCtx`), so they land on the Chat lane.
