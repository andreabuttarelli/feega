# Calendar shows the normal empty state without a brand

Opening Calendar on a project without a brand showed a dead-end message ("This project has no
brand yet") instead of the calendar itself. `buildCalendarData` (`calendar-load.ts`) already
returned an empty, well-shaped result for that case (`{ brand: null, brands, accounts: [],
posts: [] }`) — the block was purely in `+page.svelte`, which branched into a separate CTA
screen instead of falling through to the same "no posts yet" state a brand-less project should
render.

## What changed

`+page.svelte` no longer branches on `brand` for the main view. Without a brand it shows a small,
non-blocking hint above the (empty) list — "Posts appear here once a brand is set" with a link to
Brand settings — then renders the same "No posts yet" state as a project with a brand and no
posts. Nothing about `calendar-load.ts` or the schedule/publish actions changed.

## Also: project switcher shows when each was last touched

The top-bar project switcher (`CanvasTopBar.svelte`) lists projects by name only, so two projects
sharing a name (e.g. two "Untitled") were indistinguishable. Each row now shows a small last-
edited stamp next to the name — time for today, date otherwise — sourced from the same
`lastActiveAt` the landing-page fix above computes.
