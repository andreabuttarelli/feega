# A frame save the database times out is tried again, an import never answers 500 for it

The first URL import of a big page (stripe.com, 2.4 MB doc) answered 500: `commit_motion_revision`
was cancelled by the statement timeout (57014) while the database was busy (the same minute,
`/motion/<id>/source` and `/components` reads timed out too). A retry by hand succeeded.

- `commitRevision` tries a write cancelled for its statement timeout again after 0.5, 1.5 and 3 s.
  Safe: a cancelled statement rolls back, and the expected version still guards the write.
- If the database stays busy, the import answers `busy` (503) instead of 500; the dialog already
  retries `busy` on its own, and the frames already placed are removed.
- Not done: making the commit itself cheaper (the RPC receives the whole doc); that needs a
  migration and a measurement of where the RPC spends its time.
- Tests: `motion-revisions.test.ts`, `import-url.test.ts`.
