# Calendar node for draft planning

A `calendar` node type (`nodes_type_check`, `NODE_DATA_SCHEMAS`: `view`
week|month, `scope` canvas|brand, `brand_id`, `anchor`) plans drafts on the
canvas.

Before: drafts had no date; the Calendar page placed a post only by Zernio's
`scheduledFor`, so a draft existed nowhere on a calendar.

Decisions:

- `posts.planned_for timestamptz null` (migration
  `20260929210000_calendar_node.sql`, applied). A plan, not a delivery:
  Zernio stays the only truth for scheduled posts; `placedInstant` prefers the
  delivery time and falls back to `planned_for`.
- Moving a draft is optimistic on `posts.updated_at` (trigger-maintained;
  the written value comes back from the update). Zero rows = 409 `conflict`.
- Canvas scope = posts whose `post_sources` hit non-deleted nodes of this
  canvas; brand scope = the brand's `draft`/`ready` posts.
- Dropping canvas nodes on a day reuses `create_post` (now takes
  `planned_for`, and no `caption` field means the nodes' caption).
  `CanvasFlow` gained `onTileDragOver`/`onTileDrop`; a taken drop returns the
  tiles to where the drag started.
- Schedule = `schedulePlanned`: connected accounts of the post's brand, at
  `planned_for`, refused when missing or in the past (Zernio would publish
  now), then `ready`.
- Grid math lives in `src/lib/calendar/period-grid.ts` on top of
  `month-grid.ts`; timezone is the viewer's.
- Refresh: posts are not in realtime, so the node refetches on focus, every
  60s and after its own writes.
- Share view shows the period only: no drafts, no brand id leak.
- REST/MCP `create_post` accepts `planned_for`; `list_posts` returns
  `plannedFor`. No CLI calendar command exists to update.

Discarded: a separate `+server.ts` read endpoint (would duplicate the canvas
scope check), realtime on `posts` (publication change, not needed yet).
