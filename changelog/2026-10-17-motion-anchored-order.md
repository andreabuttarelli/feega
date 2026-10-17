# Motion track/clip order: ops anchor on a neighbour, not an index

`TrackAdd/TrackMove/ClipAdd/ClipMove` carried an absolute `index`, and
`diffDoc` emitted a move for EVERY track once any moved. Rebased on a
peer's insert, indexes shifted: a peer's new first track ended at the
bottom, a clip I added after X landed before it.

Now the ops carry `after: <id> | null` (the neighbour it follows, null =
first). `diffDoc` keeps the longest run of items still in their old
relative order (`settled`, LIS) and emits moves only for the rest, so a
peer's insert between untouched items survives. An anchor deleted by a
peer appends at the end.

This is the fractional-order decision applied without a migration: the
order lives in the doc array, the ops name a neighbour instead of a slot.
Legacy ops with `index` (outbox entries from older tabs) still parse and
apply. Canvas nodes keep integer `z` with an `id` tie-break.
