# Canvas client posts its actions over bearer

Every canvas action the browser sends — the page's `send()`, next-step chips, canvas list
(new/rename/delete canvas, rename project), share from the project layout, library upload and
link import — now goes through `postCanvasAction` (`$lib/canvas/canvas-api.ts`) to
`/api/v1/projects/[projectId]/canvases/[canvasId]?action=`, with the Supabase bearer, instead of
`?/<action>` on the page. Same handlers underneath (ADR 0014), so behaviour is unchanged.

`$lib/api/client.ts` is the dashboard's bearer caller, moved so canvas and editor share it.
`canvasActionOf` keeps a 5xx as an `error` result with its message, so `db_busy` is still told
apart from a generic failure.

Known difference: a thrown 4xx `error()` (canvas gone: 404, view-only mode: 403) used to reach
the client as `type: 'error'`, shown as the generic server banner; over bearer it is a `failure`
with that status, so the banner says the canvas is gone or access was refused. The bearer answer
cannot tell the two apart (ADR 0014), and the specific banner is the truer one.

Still on the page: the canvas `load` (SSR). Moving it to `+page.ts` is the next step for the
native bundle.

e2e waits and mocks that matched `?/<action>` also match `action=<action>`; the spend guard
blocks `?action=run`.
