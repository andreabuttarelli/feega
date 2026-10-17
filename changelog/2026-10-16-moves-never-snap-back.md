# Moves, resizes and group moves go through a save queue

Before: `move`, `resize` and `moveGroup` in the canvas page posted once;
on any failure (network, 5xx, busy) move/resize rolled back to the old
box, and a resync could snap a tile back while its move was in flight.

Now `place-save.ts` runs one `save-scheduler` queue per placement action:
sent at once, coalesced per node, retried with backoff on transient
failures, dropped only when refused. `keepPlaced` keeps the local box of
a tile whose placement is still unsent when a snapshot lands. Pending
placements are flushed on hide, pagehide and navigation, and count for
the unsent-changes prompt.

Not yet: connect/disconnect (next PR), durable queue across reloads.
