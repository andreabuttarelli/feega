# `GET /api/v1/me/bootstrap`: the dashboard layouts as one API call

First step of the client-only dashboard (ADR 0009, option d). The root and `/app` layouts load
session, profile, workspaces, credits, projects and the terms/tour flags on the server. A static
bundle (native shell) has no server, so it needs the same data over the API.

`appShell` is split into `shellOf(db, user, orgId)`, and the root layout's terms/tour reads move to
`firstRunFlags(db, user)`; layouts and endpoint call the same functions, and parity tests compare
their output. JWT only: the shell needs the auth user (`created_at` for the tour), which an API
key does not carry. `?org=` replaces the `dz-org` cookie; a user with no workspace gets
`404 no_organization` where the layout redirects to `/`.

Not yet consumed by any page. Recents with `last_edited_at` (#611) are not in the payload: they
belong to the `/app` page load, the next endpoint.
