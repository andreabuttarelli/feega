# Legacy hosted embeds rebuilt on first visit

#371 made `/e/<id>` compose the page from a stored source block, so embeds use the current
runtime. Pages published before it still carry the frozen composed HTML and only get on-read
patches, so they keep the old frame cost.

Now `/e/<id>` serves a legacy page as before and, in the background (`runInBackground`), rebuilds
it once (`embed-rebuild.ts`, ports in `embed-rebuild-db.ts`, service role declared):

- Source: the motion revision that was head at the file's storage `updated_at`
  (`created_at <= updated_at`, highest version) — never the current doc.
- Guard: the revision is composed and its fingerprint (dims, duration, playback, loop, top-level
  clip ids with start/duration, visible text) must equal the legacy page's. Else no write.
  Probe on fd37d96f: revisions 1–20 mismatch, 21–23 match (style-only edits are invisible to the
  fingerprint; the time rule picks 22).
- Skipped: unpublished, deleted node, missing node, uncensored project, unreadable legacy shape.
- One rebuild per id: per-instance memo + `embeds/rebuild-locks/<id>` created with
  `upsert: false`; the file is re-read before writing and left alone if republished meanwhile.
  The lock is released on any non-success.
- Each attempt logs `[embed-rebuild] <id> <outcome>`.

`npm run embed:report` (read-only, service role) counts embeds by state. Production on
2026-10-10: 36 embeds, 0 new, 22 legacy-rebuildable, 14 legacy-not-rebuildable (all `no_node`:
the node row no longer exists).

Discarded: rebuilding from the current doc (leaks unpublished edits); rebuilding synchronously
(compose + asset inlining on the request path).
