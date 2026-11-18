# Version timeline

Step (c) of Compare versions. `frameRetarget` reads the version mark, imports the original's
route at the new ref in the version frame's place, marks it and removes the old frame. A new
frame, not a rewrite of the old doc: an import builds its own tree, components and variables,
and replacing in place would mean merging two imports.

`frameCompare` and `frameRetarget` share `opened` and `landVersion`. The compare endpoint takes
either `{nodeId, refs}` or `{versionId, ref}`; CLI `feega github version-ref`, MCP
`github_version_ref`.

In the diff panel, `timelineOf` turns the newest-first history from `/github/versions` into
oldest-to-newest steps; the scrubber moves the version on release, not on every step, so one
drag is one import.
