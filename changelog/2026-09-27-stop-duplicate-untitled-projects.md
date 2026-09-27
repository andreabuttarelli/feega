# Stop creating duplicate "Untitled" projects, land on the used one

Org `test` had four projects named "Untitled": the real one (21 Sep, 29 nodes) and three near-
empty duplicates created within three minutes on 24 Sep. `homePathFor` always sent the user to
the newest project — so a burst of near-simultaneous requests hitting the bootstrap path made it
look like the app kept spawning new projects on its own.

## What created the duplicates

Every sign-in path (`login`, `/auth/callback`, `/auth/reset-password`, `/app`, the root hook)
calls `homePathFor` → `enterApp` → `projectIdFor` (`src/lib/server/tenancy/entry.ts`).
`projectIdFor` did `listProjects` then, if empty, `createProject` — two steps, not one
transaction. Two requests close together (two tabs, or an OAuth popup racing the main tab) could
both see zero projects and both insert one, same as the already-known org-creation race that
`firstOrgOnce` guards against.

## What changed

- `projectIdFor` now goes through `firstProjectOnce`, an in-flight promise cache keyed by
  `orgId` — same pattern as `firstOrgOnce` for the org-creation race. A second call while the
  first is still in flight reuses its result instead of inserting again.
- `listProjects` (`src/lib/server/repos/projects.ts`) now returns each project's `lastActiveAt`:
  the project's own `updated_at`, or its most recent (non-deleted) node's `updated_at` if that's
  later — `projects.updated_at` only moves on rename or brand change, never while working on the
  canvas, so it alone can't tell a used project from an abandoned one. Projects sort by
  `lastActiveAt` descending.
- `enterApp`/`homePathFor` take an optional `lastProjectId`. `/p/[projectId]/+layout.server.ts`
  sets a `dz-last-project` cookie on every project visit; every sign-in path reads it back and
  passes it through, so a user with multiple projects lands on the one they were last in. Without
  a cookie (first visit, or the last-visited project got archived), it falls back to
  `lastActiveAt` — a real project with nodes ranks above an empty duplicate even though both were
  born the same day.

No migration: the fix is an in-memory guard, same class as the existing one for orgs. It doesn't
close a true cross-process race under heavier concurrency — a DB-level unique constraint or
upsert would, but that's a separate change and isn't needed to explain what happened here (three
inserts from the same browser session within three minutes).

## The three empty duplicates

Still in the database, untouched: `1f96cc0e-93ba-4472-a3d3-f29380d82aeb` (2 nodes),
`86e3524a-e111-4627-bf81-cae86a4d7fe6` (0 nodes), `f29e7554-eb93-4744-8ad5-28b828f8e4b4` (0
nodes). Left for the user to archive or delete — this change stops new ones from appearing, it
doesn't touch existing rows.
