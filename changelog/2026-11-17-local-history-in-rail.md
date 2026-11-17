# History in the rail, in local mode too

The rail entry `history` in `NAV_ENTRIES` had no `local: true`, so `navEntriesByGroup` dropped it
whenever `PUBLIC_FEEGA_LOCAL=1`. A `.feega` file opened with `scripts/local.mjs` showed Layers,
Assets, Components and Styles but no History, while hosted had it at `Alt+6`.

The entry now carries `local: true`: same `FloatingRail` entry, same `HistoryPanel`, same
`/p/<project>/c/<canvas>/history` route, fed by the local store's in-memory `canvas_events`. No
local copy of the panel. `Versions` stays off in local mode (`LocalOff.Versions`), so the panel
hides "Save version" there.

Limit: `canvas_events` is not in the store's `PERSISTED` set and the `.feega` format has no slot
for it, so the history survives reloads but not a restart of the local server.

Considered: a bottom-right History button for local only. Rejected: a second entry point to the
same panel is the divergence being removed.
