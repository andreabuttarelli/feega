# The .feega file keeps its code links

Local mode is a memory database saved to the `.feega` file, but only the tables in `PERSISTED`
reached the disk. `frame_code_links` was not one of them: an imported page lost its link, and
with it the `feega/` branch, the pushed sha and the touched files, at the first reopen. Decision
20 of the github-sync spec says the file is the truth for the links and the unpushed work.

The canvas JSON gains an optional `codeLinks` array of link rows without `org_id` and
`project_id`, which the store puts back on open. An array, not a map by node, because #2279 gives
a node several links (page, component main, instances). Links of deleted
nodes are dropped. The push history lives in the link row (`push_*`, `pull_number`), so it
travels with it. `git_push_locks` is not persisted: a lock is a two-minute lease, meaningless
after a reopen.

Test: `feega-store.test.ts`, link with push fields saved, reopened, read back equal.
