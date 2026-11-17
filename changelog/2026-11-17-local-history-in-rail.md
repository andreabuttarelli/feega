# History in the rail, in local mode too

The rail entry `history` in `NAV_ENTRIES` had no `local: true`, so `navEntriesByGroup` dropped it
whenever `PUBLIC_FEEGA_LOCAL=1`. A `.feega` file opened with `scripts/local.mjs` showed Layers,
Assets, Components and Styles but no History, while hosted had it at `Alt+6`.

The entry now carries `local: true`: same `FloatingRail` entry, same `HistoryPanel`, same
`/p/<project>/c/<canvas>/history` route, fed by the local store's in-memory `canvas_events`. No
local copy of the panel. `Versions` stays off in local mode (`LocalOff.Versions`), so the panel
hides "Save version" there.

The history now lives in the file. `canvas_events` joined `PERSISTED`; the `.feega` canvas gets an
optional `events` array (the format version stays 1: files without it open, older readers drop the
field). Bound: the latest `MAX_PERSISTED_EVENTS` (1000) events by id. A count, not bytes: each event
holds node before/after snapshots, and a count keeps the newest changes whole instead of cutting
one in half. Named versions stay off in local mode.

Also, in the same change:
- File-open revisions (`motion_revisions` seeded from `heads` at every start) were stamped as You,
  dated now. They are now `system`, dated `manifest.exportedAt`. Not duplicated across restarts
  (the file keeps one head per frame, the seed makes one row per head); they only polluted the map.
- `renameNode` recorded no event, hosted included. It now writes a `node.update` with
  `{displayName}` before/after and the actor, for the page action and the `rename_node` op.
- The bottom-right "Runs" button (`RunsPanel`) wore the History icon; it now uses `WandSparkles`,
  the generate icon of the add bar. Behaviour unchanged.

Considered: a bottom-right History button for local only. Rejected: a second entry point to the
same panel is the divergence being removed.
