# Frame sources kept on the device, never stale

Frame sources live in IndexedDB keyed `canvas/node@revision@look@linked`.
The revision is the node row's `docHeadRevision`, which the page load
already returns fresh: the canvas load IS the heads query, so no extra
round trip. Motion revisions are append-only, so a key names one exact
content; `look` (hash of brand tokens, now in page data) covers brand
changes, `linked` covers linked mains. A miss goes to the batched route as
before; an answer is kept only when its revision equals the asked one.

Freshness rides the existing paths: realtime `adoptFrameHead`, resync on
subscribe and on tab reveal (`checkStale`) move the revision, so the key
changes and the old entry is never asked for; a newer keep drops it.

One DB per user and org (`feega-frame-cache:<user>:<org>`), thumbnails
too. LRU with entry and byte caps; a deleted canvas is forgotten; logout
deletes every frame DB. Supersedes #1895, which drew the cached copy
before revalidating and kept the answer under the asked revision.
