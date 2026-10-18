# Stable stacking when two people bring nodes to front at once

Two concurrent "bring to front" both write max(z)+1, and `listNodes`
ordered by `z` alone, so equal z rendered in whatever order Postgres
returned. It now orders by `z`, then `id`: every client stacks ties the
same way.

No fractional z key: the canvas only has front/back, which already write
only the moved nodes. A fractional key and migration wait until an
"insert between" exists. Motion tracks/clips get fractional order in a
separate change, because their index-based ops shift each other on
rebase.
