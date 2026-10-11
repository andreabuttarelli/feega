# The video budget: one attribution, a raise the user clicks

Follows `2026-10-11-video-budget.md` (#416). Two parts of it are replaced:

- Attribution: `withVideoContext`/`billingScope(org, node)` kept `node_id` in the brand scope,
  so any `withOrgContext` inside a turn (moderation, site reads, voice-over) reset it and its
  rows went uncounted. Now a separate `withNodeContext` wraps the whole turn
  (`startMotionTurn`), and every row written underneath carries the node.
- The raise: a typed phrase counted in the thread ("Raise the video budget and continue.",
  +$2 each) is replaced by a persisted raise. `nodes.data.budgetRaisedUsd` grows by
  `VIDEO_RAISE_USD` ($1) through `raiseVideoBudget` (`motion/video-budget.ts`). Entry points:
  the chat card (`VideoBudget.svelte` → `POST /api/v1/projects/:p/motion/:n/agent/budget`),
  `GET/POST /api/v1/motion/:n/budget`, `feega motion budget <node> [--raise]`, and the MCP
  tool `motion_budget`. A spent budget (before or during a turn) leaves a `video_budget`
  card on the reply; ask runs return `video_budget`.

`VIDEO_CAP_USD` stays $2; its value is still to be decided.
