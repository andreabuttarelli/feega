# A page served over bearer answers with the HTTP status and the action's body

Context: ADR 0009 (d) moves pages to a client-only build that reads `/api/v1` with a bearer
token. Two dialects already existed: canvas ops (`POST /api/v1/org/canvas`) answer `200` with an
error inside the body, page actions answer `fail(4xx, body)`. A client that speaks both has to
guess which one it is reading.

Decision: a page moved to the client is served by an endpoint that runs **the page's own `load`
and actions** (`$lib/server/api/bearer-page.ts`, `answerOf`), so page and API call the same
function by construction. The answer is one convention:

| Handler outcome | HTTP | Body |
|---|---|---|
| returns a value | 200 | `{ data: <value> }` |
| `fail(status, body)` | `status` | `body` as is (e.g. `409 { conflict: true, keys }`) |
| throws `error(status, message)` | `status` | `{ error: message }` |
| throws `redirect(_, location)` | 200 | `{ redirect: location }` |
| no or invalid bearer | 401 | `{ error: 'missing_bearer' \| 'invalid_token' }` |

`$lib/dashboard/answers.ts` (`actionResultOf`, `loadedOf`) turns it back into the `ActionResult`
the page already handled, so components do not change.

Canvas: `GET|POST /api/v1/projects/[projectId]/canvases/[canvasId][?action=<name>]`.

Ops stay the agent dialect (MCP/CLI): agent actor, `200` with `{ error }` or `{ outcome }`. They
are not the client's transport. Where an op and an action differ in rules (base-merged writes,
same-canvas checks), that is recorded as a divergence to resolve, not hidden by the transport.
