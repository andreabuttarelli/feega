# The canvas page is served over bearer by its own handlers, answering status and body

Context: ADR 0009 (d) moves pages to a client-only build that reads `/api/v1` with a bearer
token. Canvas ops (`POST /api/v1/org/canvas`) are the agent dialect: agent actor, no `base`
merge, different connect and same-canvas rules. Routing the canvas page through them would
change what a person's gesture does.

Decision: the canvas page is served by
`GET|POST /api/v1/projects/[projectId]/canvases/[canvasId][?action=<name>]`, which runs **the
page's own `load` and actions** (`$lib/server/canvas/canvas-page.ts`) with a bearer `locals`. Page
and API call the same function by construction, as the user: base/409 concurrency, canvas
checks and connect rules stay as they are. Ops keep serving MCP and the CLI.

The answer follows the one convention of every `/api/v1` client transport (canvas and editor):

| Handler outcome | HTTP | Body |
|---|---|---|
| returns a value | 200 | the value, unwrapped |
| `fail(status, body)` | `status` | `body` (carries `error`, or e.g. `{ conflict: true, keys }`) |
| throws `error(status, message)` | `status` | `{ error: message }` |
| throws `redirect(_, location)` | 200 | `{ redirect: location }` |
| no or invalid bearer | 401 | `{ error: 'missing_bearer' \| 'invalid_token' }` |

The client calls through the one bearer caller, `$lib/api/client.ts`.
