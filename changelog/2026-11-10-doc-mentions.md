# Asset mentions: one read per doc

`referencedAssets` ran `text.includes(id)` over a multi-MB JSON of each doc for every library
asset, and `mentionedIds` re-stringified and re-scanned the doc on every call. On the landings
fixture (6 frames, 313 assets) that was ~230 ms of the sources route per request, plus ~150 ms
of regex.

Each doc's text and its UUID mentions are now kept in a `WeakMap` keyed by the doc object; UUID
ids are matched by set lookup, other ids still by substring. Docs are immutable values (ops return
new docs), which is what makes keying by object safe.
