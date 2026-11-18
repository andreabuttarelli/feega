# Actions from a version frame

Step (d) of Compare versions, one `VersionAction` registry (`restore`, `variant`, `code_diff`)
behind one endpoint, one MCP op and three CLI commands.

**Restore** reads every file of the link (entry plus import graph) at the version sha and at
`baseSha`; the ones that differ are stored on the link as `restored` (new nullable jsonb column,
`20261117210000_frame_code_links_restored.sql`). `frameEdits` merges them over the frame's own
code edits (restored wins on the same path), so status says `modified` and the next push carries
them on the `feega/` branch and PR (decision 1, 20: pending patches). A push clears them. The
frame's canvas doc is not replaced: rewriting it from the version would make write-back diff
old `source.was` marks against new code. Files missing at the version sha are not deleted.

The `restored` column is written only when a link has one, so links keep saving while the
migration is unapplied. **The migration is not applied to production**: restore fails until it is.

**Variant** copies the version frame unlocked, without `data.version`, below it (decision 6).
**Code diff** returns before/after per changed file; `lineDiff` (LCS) renders it in the panel.
