# Products node: the limit is the total shown

Each sync of a `products` node fed the cursor saved by the previous sync (`data.after`) back
to the store fetcher, so it downloaded the *next* page, and `upsertNodeProducts` only added rows.
Limit 2, fetch twice: 4 products.

Now every sync starts from the first page and `replaceNodeProducts` deletes the node's rows
before writing the new ones. The sync no longer reads or writes the `after` cursor.
Discarded: keeping the cursor for a "load more" — no UI ever exposed it.

Test: `src/lib/server/canvas/products-limit.test.ts` (real `syncNode` → `syncProductsNode` →
products repo on an in-memory table; limit 2, 2, 3, 1).
