# Compare versions: the entry point

Step (e). The GitHub state popover of a linked frame gains "Compare versions", which opens
`RefPicker` at the same anchor. It reads `/github/versions` once and groups the answer with
`refChoices` (branches, tags, pull requests as `#n`, recent commits of the frame's file with
message and author); up to four (`MAX_VERSIONS` on the server) are compared through
`/github/compare`, and the diff panel opens on the first version against the original.

`CommitStep` and `Versions` live in `ref-choices.ts` so the client module and the grouping do
not import each other.
