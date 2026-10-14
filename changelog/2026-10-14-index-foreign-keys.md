# Index every foreign key in public

Deleting an org took 16.5 s and stalled the project: the cascade scanned every child table
whose foreign key had no index. The performance advisor listed 79 unindexed foreign keys; 78
were in `public` (the last is in `stripe`, managed by the Stripe sync, left alone).

`20261014120000_index_foreign_keys.sql` adds one btree per key, all single-column, named
`<table>_<column>_idx`. Every table is under 3k rows, so plain `create index` (no
`concurrently`). Applied to production by hand; the advisor now reports 0 in `public`.

The new indexes show up as "unused" in the advisor until a cascade or join uses them: expected.
