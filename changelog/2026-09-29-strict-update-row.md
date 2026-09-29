# update_row on nodes refuses unknown data keys

Before: `update_row` validated only the merged row, and zod objects strip
unknown keys, so a typo landed silently. `insert_row`/`create_node`
already refused them.

Now `validateNodeDataUpdate` (`src/lib/canvas/node-data.ts`) checks the
patch keys against the type schema plus `SYSTEM_OWNED_FIELDS` — the keys
the canvas and engine write outside the schemas (refId, runId, running,
error, params, mediaKind, assetId, sourceRefId, html). The error lists
every allowed field. The system list lives next to the schemas, not in
the tool.
