# Sync and run wait for my own writes

Prod report: edit a products/feed field, click sync, get "Someone else changed this node".
Cause: `sync()` in the canvas page posted `before.version` right away, while the field's
debounced `write` was still pending or in flight. The server's version-checked `running`
mark then hit the version the write had just bumped (409), or, if the write had not left
yet, synced the old field values. `run()` already flushed first; `sync()` never did.

Now both go through `postAtVersion` → `actAtVersion` (`node-save.ts`): flush the node's save
queue, hold it, send at the version the last own write left, and on a 409 (another actor)
reread once and resend at the fresh version. Only a second conflict reaches the banner.

Kept: the server contract (`run`/`sync` still version-checked; MCP and `eval:gen-node` rely
on the conflict). Discarded: making the server merge `run`/`sync` field-wise — larger surface,
same user-visible result.

Not reproduced: a loading state while typing in a source field (`canvas-own-writes.spec.ts`
types 5 s with no spinner on the baseline too). The visible spinner in the report is likely
the sync's own `sync_status: running`, left on screen by the conflict.
