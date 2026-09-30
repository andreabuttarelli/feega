# Select node outputs: images, text and custom fields

Before: a `select` on `products`/`social_account_feed` had one output carrying
the whole item (text + all media); every downstream node got both.

Now:

- `SOURCE_ITEM_FIELDS` (`select-sources.ts`) is the one table of fields per
  synced source: key, label, output port, pure extractor. `productItem` /
  `socialPostItem` are derived from it (default fields), so select, loops and
  the canvas preview read the same extractors.
- A select on a synced source has named output handles: `out:images`,
  `out:text` (defaults per source) and `out:field:<key>` for each entry of
  `data.outputs: [{ id, field, label? }]` (optional, old nodes = defaults).
  A select on a `list` keeps its single untyped output.
- The handle is stored in `nodes_connections.source_handle` (the `connect`
  action accepts `source_handle` when it starts with `out:`; otherwise the
  edge kind is stored there as before).
- `resolveUpstreamInputs` routes an edge with an `out:` handle through
  `UpstreamNode.outputs`: the target gets exactly that value. An edge without
  a handle (legacy) still gets the whole item.
- A custom output whose field the connected source does not have is flagged
  (`incompatible`), never dropped; its handle is dashed and refuses edges,
  and an existing edge on it is rejected with the reason.
- In a loop iterating the feed/catalogue, a select fed by that source follows
  the iteration index.
- Share viewer shows the select outputs read-only; `describe_node_types`
  lists fields per source in the `select.outputs[].field` description.

Discarded: product fields not stored on `products` (compare-at price, tags,
vendor, SKU, variants) — no column holds them today.
