# A gallery item owns a public copy of its files, and a remix owns a private copy

Context: a motion video names its pictures, logos, music and fonts by `assets` id, and the bytes
live in private buckets (`canvas-assets`, `brand-knowledge`) readable only by the author's org,
through URLs signed for a day at most. A public gallery that pointed at those ids would show
nothing to a visitor, and a remix would depend on the author's permissions for as long as it
exists.

Decision: publishing snapshots the saved revision into `gallery_items.doc` and copies every file
it names to the public `media` bucket under `gallery/<itemId>/`, rewriting the doc's asset ids to
the copies. The item never reads the author's project again. Remixing copies those public files
once more, into the remixer's `canvas-assets` as `imported` assets under `remix/`, and saves a new
`motion` node whose doc points at them. The chain is recorded in `gallery_remixes` (remix →
item) and becomes `remixed_from` when a remix is itself published; `remix_count` is kept by a
trigger, so no org can write another org's counter.

Consequences:

- Withdrawing sets `status = 'removed'` and deletes `gallery/<itemId>/`. Remixes keep working,
  because they hold their own copy; the row stays so the chain keeps its links.
- A remix only fetches files under its item's own gallery folder: an owner who rewrites `assets`
  cannot make the server fetch an arbitrary URL.
- Files are stored twice per remix and once per item. Accepted: the files are small, and the
  alternative (shared references with a lifetime) is the dependency this decision removes.
- What may never become public is decided before the copy, in one table
  (`src/lib/gallery/refusals.ts`): uncensored projects, a real-brand script, the project brand's
  logo, material imported from a website.
