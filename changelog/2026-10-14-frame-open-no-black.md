# Frame stays visible while the inline editor opens

Before: selecting a frame switched `MotionNode` to `NodeMode.Edit`, and `mounted` required
`previewing`. A frame whose picture came from its own player (playing, or capturing its first
frame because no poster was stored) unmounted that player at once and fell back to `.empty` on
the `#000` stage, black until the editor's player drew — 5–7 s when `/session` was slow.

Now the node's player stays while `nodeLayers(...).own` is true (`ownPlayer`), and an edited
frame with no picture shows a neutral skeleton, not the black stage.

Why `/session` was slow on 2026-10-14 13:53–13:54 UTC: agents' `@real` e2e teardowns
(`DELETE /rest/v1/orgs` cascades, 11–23 s) on the production database stalled every concurrent
query to 2–13 s. Not fixed in code; see LESSONS.md.

Not done: a WebKit desktop Playwright repro — the `@real` harness writes to production, which
is the cause of the stall itself.
