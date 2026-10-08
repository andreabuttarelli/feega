# Gallery remixes carry custom effects

Ticket 8 of custom effects.

**Publish** needed nothing new: a motion doc already snapshots every custom effect it uses in
`doc.shaders` (ticket 5), and publishing snapshots the doc (ADR 0006). The public item renders
its effects without reading the author's workspace.

**Remix** (`remixGalleryItem`) now calls `adoptShaders`: each snapshot becomes a row in the
remixer's `effects` (name kept, or `name-2`, `name-3` on a clash via `freeName`), and
`rewireShaders` points `doc.shaders` keys and every clip's `shaders[].ref` (comps included) at
the new ids — so the remixer sees and edits them with `list_effects`/`patch_effect`. Table not
migrated or a write refused → the snapshot stays as it is and still renders. Refusals table
unchanged.
