# Settings render on the client from the API

Before: `/p/[projectId]/settings/*` were server-rendered with form actions. Now eight sections
(project, brand, video, profile, content, team, api-keys, danger) load and act through
`/api/v1/me/projects/<id>/settings[/<section>]`, as #625 did for the dashboard, so a bundled
client can use them.

- Server code moved to `$lib/server/settings/` (shell + one module per section); the endpoint
  runs it with a Bearer-built event whose parent is the project shell plus the settings shell.
- Parity test: every load and action, same answer and same writes, endpoint vs direct call.
- Client: `+layout.ts` (`ssr = false`) and `+page.ts` per section; forms use
  `$lib/settings/enhance`, a drop-in for `$app/forms` `enhance` that posts settings actions to the
  API and leaves other forms to SvelteKit.

Two defects found on the way, both also on `dev` before this change:

- In the canvas sheet, a settings action's `invalidateAll` reset the page state and closed the
  sheet, so the page never showed what the action changed (`settings-brand.spec.ts` failed on
  `dev`). The enhance now reopens the sheet with fresh data (`refreshSheet`).
- The sheet passed `form={null}` to the section, so action results (a new API key, an error)
  never showed. It passes `page.form`.

Open, not fixed here: `ensureProfile` (run by the project layout on every load) overwrites
`profiles.name` with the auth metadata name, so a name saved in Profile does not stick for users
without one in their metadata.
