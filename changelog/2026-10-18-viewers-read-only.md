# Viewers are read-only everywhere

After the role split (#738) a viewer could still write wherever a
policy was not named `org_isolation` (influencers, influencer views,
effects, layouts, custom voices, app accounts, product batches,
moderation, gallery…), upload to the org's storage folders, and the
canvas, editor, chat and settings offered every control.

DB (`20261018120000_viewers_read_only.sql`): instead of rewriting each
named policy, a RESTRICTIVE insert/update/delete policy on every public
table with `org_id` requires `auth_editor_org_ids()` (restrictive
policies AND with the permissive ones, so existing rules stay as they
are). `post_sources` goes through its post. Storage: restrictive
policies on `storage.objects` via `storage_write_allowed(bucket, name)`:
`canvas-assets` and `influencers/<orgId>` by org, `embeds` by the
node's org, `media/colours/<orgId>` and brand logos by org. User-scoped
paths (`brand-knowledge/<userId>`, avatars) stay writable: they are
the person's, not the org's. Checked on a throwaway local Postgres with
stub tables: viewer reads but cannot insert/update nodes, influencers,
org files or memberships; members and owners can; transfer and leave
work.

App: `canvasModeFor(role)` puts the canvas in the existing
`CanvasMode.View` (no drag, connect, select, add bar, drop), node
bodies ignore the pointer, a "View only" pill shows, the empty-state
starters and the chat panel are hidden. Settings sections other than
personal ones (`sectionEditable`) are `inert` with a notice. The motion
editor redirects a viewer to the canvas (`assertEditor`). JWT
generation calls (`orgScopeFor`) answer 403 `view_only` before the
credit gate.
