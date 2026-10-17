# Committed edits reach peers without waiting for postgres_changes

A peer used to learn about a write through postgres_changes (WAL fan-out,
per-subscriber RLS check), then wait `REMOTE_REFRESH_MS` and refetch the
whole snapshot: 1,153 ms for a keyboard move in the two-tab e2e.

Now every successful mutating canvas action is announced by the writer on
the canvas channel as a `committed` broadcast (`commit-note.ts`). The
table `ROWS` says what each action carries: `write` the committed node
(`id, version, data`), `move` its position; any other action is a bare
nudge that makes peers refetch at once, and reads (`READS`) are never
announced. Peers apply rows in place with `adoptCommitted`: newer
`version` only, my unsent keys kept (`keepLocal`), my unsent moves kept.
The later postgres_change for the same version is dropped by `isOwnEcho`.
postgres_changes stays as the fallback for writes not made from this page
(MCP, API, agents).

Measured: 312 ms from key press to the peer's node moving, of which the
action round-trip to the database is most. Getting under 200 ms needs the
note sent before the server answers; not done, because a refused write
would then show peers a state that never existed.

Discarded: `realtime.broadcast_changes` triggers. They need a migration on
`nodes` and RLS on `realtime.messages`, and still pay the write first;
the client note gives the same latency with no schema change.
