# Free teams: 1,000 agent edits a week

On a free team, agents (sidebar chat, motion chat, MCP, CLI, API keys) may create or change
`FREE_AGENT_LAYERS_PER_WEEK = 1000` layers in a rolling seven days; paid teams are uncapped.
Human edits and reads are never counted.

The count is derived, never stored: `canvas_events` rows with `actor_kind = 'agent'` and a
`node.*` kind, plus `motion_revisions` rows written by an agent, since `now() − 7 days`
(`agent-edits/cap.ts`, partial indexes in `20261113_agent_edit_count_indexes.sql`). A frame
edit counts once per saved revision, so a batch of frame ops counts as one; a canvas batch
counts every node it touches.

The gate runs before the write, once per request, at every agent entry: the edit runners
(`/api/v1/edit`, `/api/v1/org/canvas`, frame tools, editor ops), the canvas and motion chats
before the turn, and the motion, gallery-remix and org-rows routes. A request already accepted
finishes. `agent-write-paths.test.ts` lists every file that builds an agent actor and fails
when a new one is not gated. A count that errors lets the edit through and logs it: the cap is
a free-tier limit, not a security boundary.

The refusal is `402 { error: 'agent_edit_cap', used, limit, resets_at, upgrade_path, message }`;
`resets_at` is when the oldest counted edit leaves the window. The CLI and MCP now lead any API
refusal with its `message`.

Known limits: frames created from a template through the human canvas page are recorded with an
agent actor and count toward the cap; one count costs two indexed reads per agent request.

Review fixes (same PR):
- Who decided the edit lives in one place: `AgentKey` and `AGENT_INITIATOR` in `repos/actor.ts`.
  Only agent-decided keys (sidebar, mcp, motion, api, api_key) count; loops, workflows, studio
  batches and compose are person-launched and never count.
- An agent actor can only be built by `agentActor` with a registered key: the `Actor` type
  requires an `AgentKey` for `kind: 'agent'`, and the path test fails on a literal.
- Nodes written by an API key through org rows now record `canvas_events` with the agent actor,
  so they count (and show in history).
- A frame revision counts the ops that wrote it (`motion_revisions.layers_touched`), not one.
- A batch is refused up front when it would exceed what is left, naming how many remain.
  Parallel requests can overshoot slightly; accepted and documented.
