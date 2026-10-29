# Saves survive a missing session_id column

Every component drop (and every frame save) showed "The server failed to save this change".
#1548 made `commit_motion_revision` take `p_session_id` and `motion_revisions` /
`canvas_events` write `session_id`, but `20261029150000_history_sessions.sql` is not applied in
production. The RPC answered PGRST202, the insert fallback PGRST204, the repo threw, the action
returned 500. Sentry's `handleError` logged nothing to Vercel.

- `motion-revisions.ts`: RPC retried without `p_session_id`; insert retried without `session_id`;
  `listRevisionMarks` re-reads without it on 42703.
- `canvas-events.ts`: same for insert and list.
- `hooks.server.ts`: `handleError` now `console.error`s route, url, status and error.
- Discarded: applying the migration from the agent (prod migrations are applied by a person).
  Apply it; the fallback stays so the next column lag degrades instead of breaking writes.
