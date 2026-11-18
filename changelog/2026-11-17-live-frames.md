# Live frames (PR 1: local Feega)

A live frame is an `iframe` node with `data.live = { route, width, poster }`. No new node type:
the iframe schema gains `live`, and the `.feega` store already persists `nodes.data` and the
poster asset it references.

Dev server (`src/lib/server/dev-server/`): `probe` checks the configured url and common ports,
keeping a server only if the listening process's cwd (`lsof`) is inside the opened folder —
without that check another app on 5173/5174 was taken as ours. `supervisor` spawns
`devCommand`, reads the url from its logs, keeps 200 log chunks, restarts up to 3 times, stops
on exit. `dev-server` composes them; `local-dev-server` is the node wiring. Exposed as
`/api/v1/local/dev-server` (GET status, POST start|stop), `feega dev-server`, MCP `dev_server`.

Snapshots: `POST /api/v1/local/dev-server/snapshot` screenshots the route at the frame width
with Playwright and stores it as the frame poster. The client asks on iframe load and when the
frame turns live at rest, at most every 8 s per frame.

Budget: `GpuFlow` now runs every live tile (code frames and dev frames) through
`liveFrameModes`. DOM membership uses the at-rest modes, so code frames do not unmount on every
pan; display uses the current camera motion, so during a gesture every live frame shows its
poster and the iframe is only hidden (no reload). Cap went from 4 to `MAX_LIVE_FRAMES` (3).

Limits: a hot reload does not re-shoot the poster until the next load/rest after the 8 s gap;
creating the frame awaits the server (`post('create')`, like code views), not the optimistic
runner; the frame label still reads "Code frame".
