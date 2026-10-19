# Frame session reuses the saved version it already read

After `motion-assets-query`, `head` was the critical path of the frame session: `readHead` downloads
the whole doc (322 KB on a landing frame) every open. From a client, version-only is ~70 ms,
with the doc ~130 ms.

`readHead` takes an optional `HeadCache`. With it, it asks only for the head `version`; when it
matches the cached head, the cached doc is returned (as a `structuredClone`, so a caller editing it
cannot poison the next reader). A new version is always read in full. Coalesced edits bump the
version, so the version alone identifies the content. Keyed by org and node, 64 heads, LRU. The
version query runs with the caller's client, so RLS still decides; a node it cannot see reads as
a miss and returns null. Only `editorSession` passes the cache; other callers are unchanged.

Prod build against production Supabase, 11 frame sessions per run: `head` median 209 ms → 110 ms
(warm), slower than `assets` in 10 of 11 sessions before, faster in 10 of 11 after.
