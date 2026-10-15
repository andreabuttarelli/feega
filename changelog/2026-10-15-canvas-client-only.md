# Canvas page runs client-only

`p/[projectId]/c/[canvasId]` has no server file left: `+page.ts` (`ssr = false`) loads through
`loadCanvas` and every canvas action — the page's `post()`, next-step chips, canvas list
(new/rename/delete canvas, rename project), share from the project layout — goes through
`postCanvasAction` with the Supabase bearer to `/api/v1/projects/[projectId]/canvases/[canvasId]`.
Realtime is unchanged.

`liveActionResultOf` keeps a 5xx as an `error` result with its message, so the canvas still
tells a busy database (`db_busy`) from a generic failure; the dashboard keeps `actionResultOf`.

Cache: a hover preload runs the universal load; `SwrCache.fresh` takes a warmed fetch once and
never serves a stored canvas, because a stale node list would overwrite local state through
`openCanvas`. Staleness stays the revision check's job.

Still server-bound, so not yet in the native bundle: the project layout load, asset/outline/
preview/web-view routes under `/p/.../c/...`, the motion editor.
