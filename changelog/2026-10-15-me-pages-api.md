# `/api/v1/me/pages/<page>`: the dashboard pages over the API

Step 2 of the client-only dashboard (ADR 0009, option d). Each dashboard page (`home`,
`canvases`, `templates`, `motion`, `credits`) is served by calling the page's own `load` and
`actions` with an event built from the Bearer token (`bearerOf` + `pageEvent`): same server functions, same
org checks, no copy to drift. `?org=` stands for the `dz-org` cookie, `?action=` picks the action,
every other query parameter reaches the page as its own.

Answers: `{ data }` for a load or action result, `{ redirect }` for a redirect (the client
navigates), the action's status and body for a `fail`, the status and `{ error }` for an
`error()`. `parent()` is `appShell`, the `/app` layout's own load.

`locals.supabase` is the RLS client with `auth.getUser()` answering the verified bearer user: the
credits page and the billing actions still read the user that way.

Discarded: one hand-written endpoint per page (five copies of the same auth/parse/answer code that
would drift from the pages) and rewriting the loads to drop `event` (a larger, riskier diff for
the same parity). Project/canvas rename and delete are not dashboard actions: they live on the
canvas and project settings, which stay hosted.
