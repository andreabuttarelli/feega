# Calendar page: month grid instead of a flat list

Calendar showed posts as a flat list, newest first, with no sense of when anything actually
lands. Phase 1 of the real Calendar page: a month grid, Italian month/day names, prev/next
navigation, "Oggi". Phase 2 (a brand-creation overlay instead of the current small hint) is not
in this change.

## New: `src/lib/calendar/month-grid.ts`

Pure, framework-free, tested first (`month-grid.test.ts`):

- `monthGrid(year, month, today)` — Monday-start weeks, leading/trailing days from the adjacent
  months flagged `outside`, and the day matching `today` flagged `isToday`. Weeks always come out
  full (7 days), so the grid never has a ragged first or last row.
- `placePosts(posts, grid, timeZone)` — buckets posts by their **local** day in `timeZone`, not
  UTC: a post at 23:30 UTC lands on the next calendar day in `Europe/Rome`. Posts with no
  `scheduledFor` come back separately as `unscheduled`, not silently dropped.

## `AccountDeliveryStatus` gained `scheduledFor`

`deliveryStatus` (`post-delivery.ts`) already asked Zernio for `RemotePostStatus`, which carries
`scheduledFor`, and threw it away before returning `AccountDeliveryStatus`. The calendar needs a
date to place a post on, and the delivery is the only place that date exists (posts themselves
have no scheduled-date column — see `calendar-load.ts`'s own comment on why). Added the field,
nothing else reads it yet.

## `+page.server.ts`: `?month=YYYY-MM`

New `calendar-month.ts` (`monthOf`, tested) parses the query param into `{ year, month }`,
falling back to the current month on anything missing or malformed. `+page.server.ts` no longer
changes what it queries — it now also returns which month the grid should render.

## `+page.svelte`: the grid

Renders `monthGrid` + `placePosts` (client-side, over the data the load already returns — no new
endpoint). Posts appear as small chips (platform glyphs + time + caption) on their local day;
dateless drafts go in a "Da programmare" side list. No post-detail route exists yet in this repo
(grepped for one — see the handback report), so a chip click opens a small popover with caption,
media count and per-account delivery status instead of navigating away.

Removed from `+page.svelte`: the inline schedule/publish/cancel/reschedule forms. The actions
they posted to (`+page.server.ts`) are untouched and still tested end-to-end
(`calendar.actions.test.ts`) — only their UI, which doesn't fit a month-grid chip, is gone from
this page. A scheduling UI belongs on the popover/detail view, which is follow-up work, not
phase 1.
