# Local mode: one canvas in a .feega file

`npm run local -- work.feega` starts the built app on 127.0.0.1:5173 with no
Supabase, no Docker and no login. The canvas lives in memory and is written
back to the `.feega` file (tmp file + rename, 300 ms debounce, flushed on
exit). The file is the same zip the cloud import accepts (PR #1318).

Replaces the draft PR #1329, which ran local mode on top of a Supabase stack
with an automatic login.

Decisions:

- The port is the Supabase client surface, not the canvas repositories. About
  200 server modules speak `Db`; wrapping each repository would have meant
  rewriting all of them. `db/connect.ts` is the one place that picks the
  backend: in local mode every client it builds is the file store's
  `memory-db.ts`, a PostgREST-shaped query builder over in-memory rows, with
  storage and auth stubs. The browser picks its side in `supabase/client.ts`.
- Live updates: the store emits `postgres_changes`-shaped events; `/local/events`
  streams them over SSE and the browser adapter feeds them to the existing
  `connectCanvas` handlers unchanged.
- Persisted: canvas, nodes, connections, motion heads, referenced assets with
  their bytes. Everything else (events, runs, history beyond the head) lives
  for the session only.
- Routes: one table in `local-mode.ts`. `/`, `/app`, `/login`, other projects
  redirect to the canvas; everything not listed answers 404. API calls get
  the local token and may not name another project or canvas.
- Cloud-only features answer with a message from one table: sharing,
  comments, saved versions, voices, importing another file. AI generation is
  refused at the credit gate (`creditGateOutcome`), so every AI path says the
  same thing. Running AI locally with your own keys is left out: generation
  writes runs, queues and storage the memory store does not model.
- Guard: startup refuses unless `HOST` is loopback and `PUBLIC_APP_URL` is
  localhost, and on Vercel.
- CLI/MCP: `loadSession` falls back to the local token when
  `/api/v1/version` answers `localMode: true`. `feega local <file>` runs the
  launcher from a checkout. `canvas_file save` works; opening another file
  means restarting with it.
