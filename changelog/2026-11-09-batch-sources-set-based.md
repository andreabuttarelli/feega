# Frame sources batch: no per-frame reads left

Heads come from `latestHeads` (versions in one query, docs in one), so a
node whose `docHeadRevision` lags its head is served in the batch instead
of falling back to the single route. Linked mains resolve across all
frames of the batch per depth level (`linkedHeads`), not per frame.

The batch is a GET (`?ids=`, at most 100 per request) answered with an
ETag and `private, no-cache`: as POST it re-downloaded ~11 MB on every
warm open of the landings fixture, where the per-frame route already got
304s since #1858.

Each batched frame also carries `media`: `{ [assetId]: { kind, width,
height } }` for its image assets, so the client can fetch and decode them
when sources arrive instead of after the frame build.
