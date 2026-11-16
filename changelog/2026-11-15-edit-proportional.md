# Canvas: one edit costs what it changed, not the whole frame

Audit (ast-grep: lookups inside loops, whole-doc clones and serialisation) of `src/lib/canvas`,
`src/lib/motion`, `packages/motion-core/src/motion`, plus a CPU profile of the landings edit bench.

- `applyOps` deep-cloned the doc through JSON on every remote step and undo. It now copies only
  the tracks and clips an op touches, so untouched clips keep their identity.
- `diffDoc` skips tracks that kept their identity (was ~4,000 key walks per save on 2,000 tracks).
- `findClip` indexes a doc on its second lookup; loops over a selection no longer scan per id.
  Hits are checked against the slot they point at, so an in-place move re-indexes.
- Fast patch: the "which clip changed" pair is computed once per doc pair (was three times per
  edit); a restyle of many layers and the redraw dedupe no longer search the list per entry.

Left alone: the worker build still serialises the whole doc (`sourceText`, top function in the
profile). A per-object text cache was tried and dropped: it multiplies memory by depth, and a
test pins "a phone holds each doc once". The real fix is sending ops to the worker.
Realtime `postgres_changes` still refetches the snapshot; commit notes already patch in place.
