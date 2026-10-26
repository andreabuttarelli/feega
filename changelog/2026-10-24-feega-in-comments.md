# @feega in canvas comments (FL-09)

**Before:** comments mentioned people only; the agent lived in the sidebar chat.

**Now:** a comment (or reply) containing `@feega` runs the project agent on the node the thread is
pinned to and answers in the same thread. The page action `addComment` fires `answerMention` in
the background after the comment is stored; the agent port is `CommentAgent`, implemented by
`httpAgent`, which calls the existing `POST /api/v1/projects/:id/agent` with the commenter's own
token. So credits, plan gate (`gateAiAction`), moderation and the turn itself are the sidebar's,
paid by the commenter, and the turn also shows in their sidebar thread.

**Decisions:** no migration. `canvas_comments.author_id` must equal `auth.uid()` (RLS) and
`mentions` is `uuid[]`, so the reply is written as the commenter and marked with the fixed uuid
`AGENT_MENTION_ID` in `mentions`; the panel shows those as "feega" without edit. `mentionable`
still filters to org members, so a person cannot forge the marker. Replies written by the agent
never wake it again (only the page action calls `answerMention`); ops-written comments (MCP) do
not trigger it either. A refused or failed run is answered in the thread with the reason.
`teammates()` lists the agent last so the mention picker offers it.

**Tests:** `comment-agent.test.ts` (pure and server), `comment-agent-http.test.ts`,
`canvas-page.mention.test.ts` (real action, only the agent port mocked),
`tests/e2e/canvas-comment-agent.spec.ts` (picker + reply rendering; the full turn is not run in
Playwright because it would spend on a real model).
