# The frame editor runs on /api/v1

ADR 0009 (d): the native bundle has no SvelteKit server, so the frame editor
(full page and inline in the canvas) must read and write through `/api/v1`
with a bearer token.

- `$lib/api/client` holds the bearer caller the dashboard used (`apiCall`,
  `withOrg`). The canvas client switch should use it too: one transport.
- `$lib/frame-editor/actions` (`EDITOR_ACTIONS`) turns each editor form into
  its op. The page actions and the client both read it, so they cannot drift.
- `$lib/frame-editor/client`: `editorAction` posts to
  `/api/v1/motion/{node}/ops` and answers the `ActionResult` the page action
  did (200 success, status + `{ error }` failure), so components only changed
  transport. `editorSessionOf` replaces the page load and the cookie-only
  `motion/[nodeId]/session` endpoint (removed).
- Uploads: `upload_slot` op hands a signed upload (export mp4, font); the
  browser uploads, then `record_export` / `upload_font` register it. The
  poster goes as multipart to `/api/v1/motion/{node}/poster`.
- Full-page route: `ssr = false`, load from `+page.ts` via `editor_session`.

Still on cookie routes: `embed`, `batch/[id]` zip, `preview`, `source`, and
the compose page (`/app/compose`) which keeps its own actions.
