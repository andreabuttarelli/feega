# Canvas versions keep free elements' content

Signal: restoring a canvas version left free elements with the content
they had at restore time, not the saved one.

Cause: `versionSnapshot` read the motion head only for `motion` nodes.
Free elements (`element`) keep their document in `motion_revisions` too,
so their heads never entered the snapshot and the restore had nothing to
write back.

Fix: filter on `holdsDoc`, the same predicate the `.feega` export uses
(PR #1318). The restore plan was already type-agnostic. Versions saved
before this fix still lack element documents.
