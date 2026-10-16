# Queued node edits are retried on busy and conflict

Before: `SEND_RESULT` in the canvas page had no `Busy` row, so a second
statement timeout returned `undefined`; the scheduler treated it as final
and emptied the queue. `Conflict` was `Dropped` after one reread. In both
cases the value stayed on screen and never reached the DB.

Now the table lives in `node-save.ts` (`sendResultOf`), typed as a full
`Record`, and both retry with backoff. A conflict retry rereads and
rebases (`writeWithRetry`), so the local field wins as last writer.

First PR of the local-first program; audit in
`~/Documents/feega-videos/local-first/AUDIT.md`.
