# A save no longer deep-compares the whole frame

On the user canvas copy at 4× CPU every save spent ~50 ms in `diffDoc` → `entryOps` →
`same`, which compared two serialisations of the edited comp. Three causes:

- `same` serialised both sides even when most of the subtree was shared. It is now a
  structural compare that stops at the first identical reference.
- after a save the server's copy became the next base, so the next diff walked two docs that
  shared nothing. A save that lands at `base + 1` was applied on our own base, so the doc we
  sent is the server's doc: `landed` now keeps it as the base. Rebased saves keep the
  server copy.
- `liveDocs.set` replaced the map and woke every reader even when the save echoed the doc
  already shown. It now returns early on an identical live doc.
