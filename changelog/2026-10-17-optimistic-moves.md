# Moves reach peers before the server answers

#725 announced a move after the action returned: 312 ms, mostly the
write round-trip. Position is last-write-wins, so `createPlaceSaves` now
announces a move (`announce.intent`) the moment it is scheduled; peers
adopt it in place. If the server refuses it (`SendResult.Dropped`),
`announce.refused` sends a bare note and peers refetch the confirmed
state, so they converge. The confirmation of a move is no longer
announced (`UNANNOUNCED`), since it carries nothing new. Every other
field keeps confirm-then-broadcast.

Two-tab e2e: 54 ms from key press to the peer's node moving (was 312).
Resize and group moves still announce on confirm: a size note would need
the page's height rules, and a group move moves members server-side.
