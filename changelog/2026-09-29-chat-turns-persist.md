# Chat turns persist on projects with a brand

**Before:** a project with a brand sent the chat to `/api/v1/brands/[slug]/agent`, still on the
old schema (`chat_threads.user_id`, `chat_messages.brand_id/user_id/model/duration_ms`, no
`org_id`/`seq`): 500 on GET and POST since `bca246b1` (09-22), reached by the canvas since
`aa2103a5` (09-23). The project route also 500'd with a brand attached: it saved the user turn,
then `openBrandMcp` failed with ENOTFOUND (`mcp.feega.app` does not resolve).

**Now:** the panel always uses the project route. An unreachable brand MCP is logged and the
turn runs on project tools. The assistant turn saves the text of every step plus its tool calls
(`chat_messages.tool_calls`), so tool chips survive a reload. Save failures log `console.error`.

**Left:** the dead brand route and `brand-agent/thread.ts`/`turns.ts` await deletion approval.
Brand tools stay off until `BRAND_MCP_URL` resolves.

Guard: `tests/e2e/chat.spec.ts` (@real) — send, 2 rows in `chat_messages`, reload, both visible.
