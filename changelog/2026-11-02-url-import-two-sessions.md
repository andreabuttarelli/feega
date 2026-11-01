# URL import holds two Browserless sessions, not three

With breakpoints on by default (#1701), an import read the desktop, tablet and phone
widths at once: three Browserless sessions. The plan admits two: the third connect is
refused with `429` (measured: 1 and 2 at once connect, the 3rd and 4th answer 429). When
the refused one was a breakpoint, that view went missing in silence; when it was the
desktop read, the import answered 500 — about half the imports in the pre-release sweep.

`importPageAt` now reads the breakpoints one after the other, beside the desktop read:
two sessions at most. The import takes about one more page read when there are two
breakpoints.

Discarded: reading all three in sequence (slowest, and the desktop read is never the
one at risk with two sessions); making the 429 retryable alone (the sessions it waits
for last the whole read, so a retry seconds later meets the same refusal).

Still open: in the server bundle the refused connect arrives as an `ErrorEvent`, which
`hidden()` turns into `Error: [object Object]`, so a 429 is neither recognised as
retryable nor readable in the log.
