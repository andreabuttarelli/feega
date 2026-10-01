# Calendar node takes connections and explains itself

**Why.** The calendar had no ports and a blank grid. Posts arrived only via
Promote or by dropping a selection on a day, and without a brand that drop
answered with an error after the fact.

**What.**
- `NODE_PORTS.calendar` accepts `images`, `videos`, `audios`, `text`;
  `graph.ts` gains a `calendar` spec and `node-model.ts` maps the row, so the
  server `connect` action no longer refuses the edge (it read the calendar
  as an `iframe`, "already exists").
- A new edge into a calendar opens a "Plan on…" picker (day, plus brand when
  none is set). Submitting calls `create_post` with `planned_for`, same path
  as the day drop. A drop without a brand opens the same picker.
- Empty state: "Pick a brand first" when no brand, otherwise "Connect or drop
  images, videos or text here to plan posts" (`calendarHint`).
- Default brand: `projects.brand_id`, read by `findCanvasForUser` and passed
  through the page load as `projectBrandId` (`calendarBrand`).

**Wiring.** edge drawn in `CanvasFlow.svelte` → `connect()` in
`+page.svelte` → action `connect` → `nodes_connections`; then `askToPlan` →
picker in `CalendarNode.svelte` → `draftOnDay` → action `create_post` →
`createPostFromNodes` → `posts` + `post_sources`.

**Tests.** `node-ports.test.ts`, `calendar-node.test.ts` (brand, hint),
`lookup.test.ts` (project brand), route `calendar-node.test.ts` (connect then
create_post through the real actions; the connect step failed before the fix).
