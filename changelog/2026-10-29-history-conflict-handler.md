# History: explicit row for conflict entries

#1566 added `HistorySource.Conflict` after #1565 created `HANDLERS`; `svelte-check` flagged the
missing row and `previewAt`/`actAt` would throw on a conflict entry.

- Row is `{ writes: {} }`, matching `SOURCE_ACTIONS` (`[]`): conflicts resolve through
  `resolveConflict`, not from History. Both calls answer `unsupported`.
