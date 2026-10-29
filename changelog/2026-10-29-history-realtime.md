# History panel updates live

The History panel read the timeline once and again only after the viewer's own action, so
edits by teammates, the chat or MCP agents appeared only on reopen.

- `watchHistory` (`src/lib/realtime/history-channel.ts`) subscribes to `canvas_events`,
  `canvas_versions`, `canvas_conflicts` and `nodes` for the canvas. `nodes` is already
  published and stands in for `motion_revisions`, which has no `canvas_id` to filter on.
- `liveRefresh` (`src/lib/canvas/history/live.ts`) coalesces changes into one read per 400 ms,
  polls every 15 s when the channel is not subscribed, and rereads on focus. Hidden tabs skip.
- `mergeGraph` keeps unchanged rows by identity so the list does not re-render on every read.
- Migration `20261029180000_history_realtime.sql` publishes the four history tables
  (replica identity full on the mutable ones). Not applied to production: until it is, node
  edits arrive live and versions/conflicts on the next focus or own action.

Discarded: incremental client-side merge of raw rows (lanes and filters are computed server
side; duplicating them would split the rule in two).
