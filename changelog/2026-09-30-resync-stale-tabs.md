# Resync stale tabs on return

**Why.** A tab left open for hours (sleep, discard, bfcache, lost network)
came back showing old nodes. Only `visibilitychange` refetched; `focus`,
bfcache `pageshow`, `online`, a realtime channel that died `CLOSED` /
`TIMED_OUT`, and a new deploy did nothing. An unsent edit on a node deleted
elsewhere kept retrying into a 404.

**What changed.**
- `revision` action on the canvas page: `canvasRevision` in
  `src/lib/server/canvas/revision.ts` hashes live node stamps
  (id, version, x, y, size) and edge ids — no `data`, runs or products. It
  also says `canvas_gone` / `project_gone`. Load and `snapshot` carry the same
  hash (`recordsRevision`) as the baseline.
- `src/lib/canvas/staleness.ts`: one rule table (`judge`) maps
  revision/remote state/trigger/app version to verdicts: resync, leave canvas,
  leave project, offer reload. The page maps each verdict to one reaction.
- `onCanvasReveal` listens to `focus`, `pageshow` (persisted only), `online`.
- `connectCanvas` reopens a channel that closes or times out; its rejoin
  runs the revision check.
- Resync drops unsent edits of nodes deleted remotely (`orphanedEdits`,
  `saves.discard`) and says so; surviving edits merge via `keepDirty`
  (server-written fields still win). Canvas list is invalidated too.
- The "updated elsewhere" notice shows only when `changedElsewhere` sees a
  real difference, so own echoes stay silent.
- `kit.version.pollInterval = 60s`; `updated.current` feeds the table and
  shows a Reload banner. No silent auto-reload.
- Deleted canvas → `/p/<project>`, deleted project → `/app`, with a message
  carried across the navigation (`carryNotice` / `takeNotice`).

**Discarded.** `max(updated_at)`: not every write path (RPC, agents) sets
`nodes.updated_at`, and connections have none. A toast library: the page
already has one alert slot (`failed`); reused it.

**Not done.** Playwright scenario (cost); chat store untouched.
