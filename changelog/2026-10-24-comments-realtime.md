# Comments update live

`connectCanvas` takes `onComments` and subscribes to `canvas_comments` (filter `canvas_id`) on the
existing `canvas:<id>` channel. Needs `20261023160100_canvas_comments_realtime.sql` (publication +
`replica identity full`), applied to production on 2026-10-24.

- Any insert, update or delete refetches the thread list instead of patching it locally: soft
  delete and resolve arrive as UPDATEs, and one code path (`loadComments`) cannot disagree with
  itself.
- Fallback for a missed event: refetch on window focus, on tab visible and on realtime reconnect.
- E2E: two browser contexts on the test account; window B sees A's insert, edit and delete with
  no reload. Gotcha when running e2e: `reuseExistingServer` picks whatever listens on 4173, which
  can be another worktree's dev server (it served stale code here). Start your own on another
  port and pass `E2E_BASE_URL`.
