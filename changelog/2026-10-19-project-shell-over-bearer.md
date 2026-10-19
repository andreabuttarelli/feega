# Project shell loads in the browser

The `/p/[projectId]` layout load (profile, org, project, brand, credits, project and canvas lists)
moved to `$lib/server/projects/project-shell.ts` and is served by
`GET /api/v1/projects/[projectId]/shell`. The layout is now `+layout.ts` (`ssr = false`), with
the same `depends('app:credits', 'app:canvases')`.

Without this the canvas and editor, already client-loaded, still needed the server for their
parent layout: the native bundle could not open a project.

The last-project cookie (`homePathFor`) is set by the endpoint on success, through
`rememberProject`, the one place that writes it.

Server pages under `/p` that read the layout through `parent()` (project home redirect,
settings products/connected-accounts/facebook/linkedin, calendar) now call the shell load
themselves: with no server layout, `parent()` would be empty. They stay server-bound (the social
ones are behind the `social_publishing` flag).

Cost: every `/p/...` page is now client-rendered.
