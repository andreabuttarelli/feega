# Long script briefs survive the saved reply row

**Before.** `toolsForMirror` clamped every tool output over 2000 JSON chars to a truncated
string. A `write_script` brief over that size was saved as a string, so once the client swapped
the streamed message for the server row (poll / turn-end reload, #256) `savedBrief` found no
`ok`/`brief` and the script card with Go vanished. Prod rows 73f5093a and addfd954 (2026-10-08)
store the successful output as a string; a shorter brief at 10:55 stayed an object.

**Now.** Outputs of tools the UI reads back (`OUTPUTS_READ_BACK`, today `write_script`) are kept
whole. The brief is bounded by the script schema, so the row stays small.

**Design kept.** The turn already ends after proposing (`briefAwaits` stop); Go starts the next
turn. Nothing waits server-side, so there is no deadlock to time out.
