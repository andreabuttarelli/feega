# get_selection canvas op

Agents (MCP, chat, edit) could not tell what "this" meant. Selection and viewport already travel on the `canvas-peer` broadcast (3 s heartbeat, never stored). `get_selection {canvasId}` joins the canvas channel, listens up to 3.5 s (returns 20 ms after the caller's first mark), and answers the caller's marks per session: `{sessionId, selection, view, at}`; `reason: no_open_session` when none.

The canvas is first proven to belong to the caller's project. API keys have no JWT, so the channel is joined with the service role (registered in `service-role-uses.ts`); only marks whose `userId` is the caller's are kept, nothing is written. Discarded: storing selection in the database.
