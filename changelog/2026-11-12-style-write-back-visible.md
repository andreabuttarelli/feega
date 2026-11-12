# Style edits reach the code: the token map kept its style fields

**Before.** #2071 made text and effect styles write back to the CSS declaration they came from,
keyed in the frame's token map by `<style>#<field>` with `style`, `field` and `rule` on each
entry. The import stored those entries on the node (`data.code.tokens`), but every reader parses
`data.code` through `codeOriginSchema`, whose token entry is a plain `z.object` listing only
`name`, `origins`, `raw`, `scale`, `orphan`. Zod dropped `style`, `field`, `rule` (and
`factor`, from the spacing multiples) on read, so `writeTokens` saw no style entries: editing
traidue's `article .prose h2` to 28 px / 700 left the changes view at "No edits to send yet",
and Write to folder had nothing to write. The server-function check in #2071 passed the map
straight to `writeTokens`, so it never crossed the schema.

**Now.** The schema lists the four fields. `code-sync.styles.test.ts` runs `codeChanges` on a
folder origin whose tokens went through the schema and asserts the patch of `src/app.css`.

**Found while** chasing the `effect_update_depth_exceeded` reported on the same flow, which did
not reproduce here (see the PR).
